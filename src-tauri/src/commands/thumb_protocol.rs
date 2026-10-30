//! Les vignettes passent par le schéma `thumb://` : la webview ne contacte jamais les hôtes
//! tiers. Les octets sont servis directement (cache HTTP de la webview, sans base64 ni IPC),
//! après un passage par le cache disque et un client réseau qui refuse le réseau local.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::http::{header, Response, StatusCode};
use tokio::sync::Semaphore;

use super::thumb_cache;

/// Plafond de taille (5 Mio) : une vignette au-delà est forcément autre chose.
pub const MAX_BYTES: usize = 5 * 1024 * 1024;

/// Nombre de téléchargements simultanés : un historique de 50 lignes ne lance pas 50 requêtes.
const MAX_CONCURRENT: usize = 6;

/// Une URL qui a échoué n'est pas redemandée avant ce délai (liens signés expirés…).
const FAILURE_TTL: Duration = Duration::from_secs(10 * 60);

/// Instagram sert des 403 aux clients non reconnus : on se présente comme Safari iOS.
const USER_AGENT: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/// Type MIME d'une image reconnue à ses premiers octets ; `None` pour tout le reste (HTML
/// d'une page d'erreur, SVG, binaire quelconque…).
pub fn sniff_image(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if bytes.len() >= 12 && &bytes[4..8] == b"ftyp" && &bytes[8..12] == b"avif" {
        Some("image/avif")
    } else {
        None
    }
}

/// Le Referer d'Instagram n'est envoyé qu'aux CDN qui l'exigent.
pub fn referer_for(host: &str) -> Option<&'static str> {
    const INSTAGRAM_HOSTS: [&str; 3] = ["instagram.com", "cdninstagram.com", "fbcdn.net"];
    INSTAGRAM_HOSTS
        .iter()
        .any(|h| host == *h || host.ends_with(&format!(".{h}")))
        .then_some("https://www.instagram.com/")
}

pub struct ThumbService {
    client: reqwest::Client,
    cache_dir: Option<PathBuf>,
    permits: Semaphore,
    failures: Mutex<HashMap<String, Instant>>,
    /// Faux uniquement dans les tests, qui parlent à un serveur local en clair.
    strict: bool,
}

impl ThumbService {
    pub fn new(cache_dir: Option<PathBuf>) -> Result<Self, String> {
        Ok(Self {
            client: crate::net::remote_client()?,
            cache_dir,
            permits: Semaphore::new(MAX_CONCURRENT),
            failures: Mutex::new(HashMap::new()),
            strict: true,
        })
    }

    fn recently_failed(&self, url: &str) -> bool {
        let mut failures = self.failures.lock().unwrap_or_else(|e| e.into_inner());
        match failures.get(url) {
            Some(at) if at.elapsed() < FAILURE_TTL => true,
            Some(_) => {
                failures.remove(url);
                false
            }
            None => false,
        }
    }

    fn remember_failure(&self, url: &str) {
        self.failures
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(url.to_string(), Instant::now());
    }

    /// Octets et type MIME de la vignette d'une URL distante.
    pub async fn get(&self, url: &str) -> Result<(Vec<u8>, &'static str), String> {
        let parsed = if self.strict {
            crate::net::check_remote_url(url)?
        } else {
            reqwest::Url::parse(url).map_err(|e| e.to_string())?
        };

        if let Some(dir) = self.cache_dir.clone() {
            let key = url.to_string();
            let cached = tokio::task::spawn_blocking(move || thumb_cache::read(&dir, &key))
                .await
                .ok()
                .flatten();
            if let Some(mime) = cached.as_deref().and_then(sniff_image) {
                return Ok((cached.unwrap_or_default(), mime));
            }
        }
        if self.recently_failed(url) {
            return Err("Failed to fetch thumbnail".to_string());
        }

        let fetched = {
            let _permit = self.permits.acquire().await.map_err(|e| e.to_string())?;
            self.download(&parsed).await
        };
        let bytes = match fetched {
            Ok(bytes) => bytes,
            Err(e) => {
                self.remember_failure(url);
                return Err(e);
            }
        };
        let Some(mime) = sniff_image(&bytes) else {
            self.remember_failure(url);
            return Err("Not an image".to_string());
        };

        if let Some(dir) = self.cache_dir.clone() {
            let key = url.to_string();
            let copy = bytes.clone();
            let _ =
                tokio::task::spawn_blocking(move || thumb_cache::write(&dir, &key, &copy)).await;
        }
        Ok((bytes, mime))
    }

    async fn download(&self, url: &reqwest::Url) -> Result<Vec<u8>, String> {
        let mut request = self
            .client
            .get(url.clone())
            .header(header::USER_AGENT, USER_AGENT);
        if let Some(referer) = url.host_str().and_then(referer_for) {
            request = request.header(header::REFERER, referer);
        }
        let mut response = request
            .send()
            .await
            .map_err(|_| "Failed to fetch thumbnail".to_string())?;
        if !response.status().is_success() {
            return Err("Failed to fetch thumbnail".to_string());
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_BYTES as u64)
        {
            return Err("Thumbnail too large".to_string());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Failed to fetch thumbnail".to_string())?
        {
            if bytes.len() + chunk.len() > MAX_BYTES {
                return Err("Thumbnail too large".to_string());
            }
            bytes.extend_from_slice(&chunk);
        }
        if bytes.is_empty() {
            return Err("Failed to fetch thumbnail".to_string());
        }
        Ok(bytes)
    }
}

/// URL distante portée par le chemin d'une requête `thumb://localhost/<url encodée>`.
pub fn remote_url_from_path(path: &str) -> Option<String> {
    let encoded = path.strip_prefix('/').unwrap_or(path);
    let decoded = percent_encoding::percent_decode_str(encoded)
        .decode_utf8()
        .ok()?;
    (!decoded.is_empty()).then(|| decoded.into_owned())
}

fn status_only(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("static response")
}

/// Répond à une requête du schéma `thumb`.
pub async fn handle(service: &ThumbService, path: &str) -> Response<Vec<u8>> {
    let Some(url) = remote_url_from_path(path) else {
        return status_only(StatusCode::BAD_REQUEST);
    };
    match service.get(&url).await {
        Ok((bytes, mime)) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            // The webview keeps it: re-opening the home screen does not ask again.
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .body(bytes)
            .expect("static response"),
        Err(_) => status_only(StatusCode::NOT_FOUND),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n0000";

    fn plain_service(cache: Option<PathBuf>) -> ThumbService {
        crate::net::install_tls_provider();
        ThumbService {
            client: reqwest::Client::new(),
            cache_dir: cache,
            permits: Semaphore::new(MAX_CONCURRENT),
            failures: Mutex::new(HashMap::new()),
            strict: false,
        }
    }

    /// Serveur HTTP minimal : renvoie `body` avec le statut donné et compte les requêtes ;
    /// les requêtes reçues sont transmises à `seen`.
    async fn serve(
        status: &'static str,
        body: Vec<u8>,
        hits: Arc<AtomicUsize>,
        seen: Arc<Mutex<Vec<String>>>,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                let body = body.clone();
                let hits = hits.clone();
                let seen = seen.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 4096];
                    let n = socket.read(&mut buf).await.unwrap_or(0);
                    seen.lock()
                        .unwrap()
                        .push(String::from_utf8_lossy(&buf[..n]).into_owned());
                    hits.fetch_add(1, Ordering::SeqCst);
                    let head = format!(
                        "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(&body).await;
                });
            }
        });
        format!("http://{addr}/t.png")
    }

    fn counters() -> (Arc<AtomicUsize>, Arc<Mutex<Vec<String>>>) {
        (Arc::new(AtomicUsize::new(0)), Arc::new(Mutex::new(vec![])))
    }

    // ── détection du type ────────────────────────────────────────────────────

    #[test]
    fn images_are_recognised_by_their_signature() {
        assert_eq!(sniff_image(PNG), Some("image/png"));
        assert_eq!(sniff_image(b"GIF89a.."), Some("image/gif"));
        assert_eq!(sniff_image(b"GIF87a.."), Some("image/gif"));
        assert_eq!(sniff_image(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(sniff_image(b"\xff\xd8\xff\xe0.."), Some("image/jpeg"));
        assert_eq!(sniff_image(b"\0\0\0\x1cftypavif"), Some("image/avif"));
    }

    #[test]
    fn anything_else_is_not_an_image() {
        assert_eq!(sniff_image(b"<html>403</html>"), None);
        assert_eq!(sniff_image(b"<svg xmlns=''/>"), None);
        assert_eq!(sniff_image(b"RIFF\0\0\0\0WAVE"), None);
        assert_eq!(sniff_image(b""), None);
    }

    #[test]
    fn the_instagram_referer_goes_to_its_cdns_only() {
        assert!(referer_for("scontent.cdninstagram.com").is_some());
        assert!(referer_for("www.instagram.com").is_some());
        assert!(referer_for("scontent-x.xx.fbcdn.net").is_some());
        assert!(referer_for("i.ytimg.com").is_none());
        assert!(referer_for("evilinstagram.com").is_none());
        assert!(referer_for("instagram.com.evil.example").is_none());
    }

    // ── chemin de la requête ─────────────────────────────────────────────────

    #[test]
    fn the_remote_url_is_decoded_from_the_path() {
        assert_eq!(
            remote_url_from_path("/https%3A%2F%2Fcdn.example%2Fa.jpg%3Fx%3D1%26y%3D2"),
            Some("https://cdn.example/a.jpg?x=1&y=2".to_string())
        );
    }

    #[test]
    fn an_empty_or_malformed_path_has_no_url() {
        assert_eq!(remote_url_from_path("/"), None);
        assert_eq!(remote_url_from_path(""), None);
        assert_eq!(remote_url_from_path("/%ff%fe"), None);
    }

    // ── service ──────────────────────────────────────────────────────────────

    #[tokio::test]
    async fn a_thumbnail_is_fetched_cached_and_then_served_from_disk() {
        let dir = tempfile::tempdir().unwrap();
        let (hits, seen) = counters();
        let url = serve("200 OK", PNG.to_vec(), hits.clone(), seen).await;
        let service = plain_service(Some(dir.path().to_path_buf()));

        let (first, mime) = service.get(&url).await.unwrap();
        let (second, _) = service.get(&url).await.unwrap();

        assert_eq!(first, PNG);
        assert_eq!(second, PNG);
        assert_eq!(mime, "image/png");
        assert_eq!(
            hits.load(Ordering::SeqCst),
            1,
            "the second call hits the disk"
        );
    }

    #[tokio::test]
    async fn the_referer_is_not_sent_to_an_unrelated_host() {
        let (hits, seen) = counters();
        let url = serve("200 OK", PNG.to_vec(), hits, seen.clone()).await;

        plain_service(None).get(&url).await.unwrap();

        let request = seen.lock().unwrap()[0].to_lowercase();
        assert!(!request.contains("referer"), "{request}");
        assert!(request.contains("user-agent"));
    }

    #[tokio::test]
    async fn a_failure_is_remembered_and_not_retried() {
        let (hits, seen) = counters();
        let url = serve("403 Forbidden", b"nope".to_vec(), hits.clone(), seen).await;
        let service = plain_service(None);

        assert!(service.get(&url).await.is_err());
        assert!(service.get(&url).await.is_err());

        assert_eq!(hits.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_non_image_body_is_rejected() {
        let (hits, seen) = counters();
        let url = serve("200 OK", b"<html>blocked</html>".to_vec(), hits, seen).await;

        let err = plain_service(None).get(&url).await.unwrap_err();

        assert_eq!(err, "Not an image");
    }

    #[tokio::test]
    async fn an_oversized_body_is_rejected() {
        let (hits, seen) = counters();
        let mut big = PNG.to_vec();
        big.resize(MAX_BYTES + 1, 0);
        let url = serve("200 OK", big, hits, seen).await;

        let err = plain_service(None).get(&url).await.unwrap_err();

        assert_eq!(err, "Thumbnail too large");
    }

    #[tokio::test]
    async fn the_strict_service_refuses_local_and_insecure_urls() {
        let service = ThumbService::new(None).unwrap();

        for url in [
            "http://127.0.0.1:1/a.png",
            "https://127.0.0.1/a.png",
            "https://localhost/a.png",
            "file:///etc/passwd",
        ] {
            assert!(service.get(url).await.is_err(), "{url}");
        }
    }

    // ── réponse du schéma ────────────────────────────────────────────────────

    #[tokio::test]
    async fn the_handler_serves_the_bytes_with_their_type() {
        let (hits, seen) = counters();
        let url = serve("200 OK", PNG.to_vec(), hits, seen).await;
        let path = format!(
            "/{}",
            percent_encoding::utf8_percent_encode(&url, percent_encoding::NON_ALPHANUMERIC)
        );

        let response = handle(&plain_service(None), &path).await;

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "image/png");
        assert!(response.headers()[header::CACHE_CONTROL]
            .to_str()
            .unwrap()
            .contains("max-age"));
        assert_eq!(response.body(), PNG);
    }

    #[tokio::test]
    async fn the_handler_answers_404_when_the_fetch_fails() {
        let response = handle(
            &ThumbService::new(None).unwrap(),
            "/https%3A%2F%2F127.0.0.1%2Fa.png",
        )
        .await;

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert!(response.body().is_empty());
    }

    #[tokio::test]
    async fn the_handler_answers_400_without_a_url() {
        let response = handle(&ThumbService::new(None).unwrap(), "/").await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
