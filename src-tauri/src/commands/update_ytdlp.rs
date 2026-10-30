use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use sha2::{Digest, Sha256};
use tauri::Manager;
use tokio::io::AsyncWriteExt;

use crate::ytdlp::finder::YtDlpBinary;

/// Réponses de la commande, que l'interface traduit : le texte ne s'affiche pas tel quel.
pub const UPDATED: &str = "updated";
pub const UP_TO_DATE: &str = "up-to-date";

/// Un transfert qui n'avance plus pendant ce délai est abandonné.
const IDLE_TIMEOUT: Duration = Duration::from_secs(30);

pub const RELEASES: &str = "https://github.com/yt-dlp/yt-dlp/releases";

/// Une seule mise à jour à la fois : deux téléchargements écriraient dans le même fichier.
static UPDATING: AtomicBool = AtomicBool::new(false);

struct UpdateGuard;

impl UpdateGuard {
    fn acquire() -> Option<Self> {
        UPDATING
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self)
    }
}

impl Drop for UpdateGuard {
    fn drop(&mut self) {
        UPDATING.store(false, Ordering::Release);
    }
}

/// Nom de l'asset yt-dlp pour la plateforme courante.
pub fn asset_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp_linux"
    }
}

/// URL d'un fichier d'une release précise : le binaire et ses sommes viennent ainsi de la
/// même release, même si une autre est publiée entre les deux requêtes.
pub fn asset_url(base: &str, tag: &str, name: &str) -> String {
    format!("{base}/download/{tag}/{name}")
}

/// Prépare le dossier de destination et renvoie le chemin du binaire. Séparé de la
/// commande pour être testable sans AppHandle.
pub fn prepare_destination(data_dir: &Path) -> Result<PathBuf, String> {
    std::fs::create_dir_all(data_dir).map_err(|e| format!("Cannot create data dir: {e}"))?;
    Ok(data_dir.join("yt-dlp"))
}

/// Rend le binaire exécutable (0o755). No-op hors Unix.
pub fn make_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Cannot set permissions: {e}"))?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

/// Somme attendue pour `asset` dans un fichier `SHA2-256SUMS` (« <hash>  <nom> »).
pub fn expected_sha256(sums: &str, asset: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (name == asset).then(|| hash.to_lowercase())
    })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Tag de la dernière release, lu dans l'en-tête `Location` de la redirection
/// `/releases/latest` (ou dans l'URL finale `…/tag/<tag>`).
pub fn tag_from_url(url: &str) -> Option<&str> {
    url.rsplit_once("/tag/")
        .map(|(_, tag)| tag.trim())
        .filter(|tag| !tag.is_empty() && !tag.contains('/'))
}

/// Dernier tag publié : la redirection n'est pas suivie, seul son en-tête compte.
async fn latest_tag(base: &str) -> Result<String, String> {
    crate::net::install_tls_provider();
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(IDLE_TIMEOUT)
        .timeout(IDLE_TIMEOUT)
        .build()
        .map_err(|e| format!("Cannot build HTTP client: {e}"))?;
    let response = client
        .get(format!("{base}/latest"))
        .send()
        .await
        .map_err(|e| format!("Cannot reach GitHub: {e}"))?;
    response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .and_then(tag_from_url)
        .map(str::to_string)
        .ok_or_else(|| "Cannot determine the latest yt-dlp release".to_string())
}

async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .timeout(IDLE_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    response
        .text()
        .await
        .map_err(|e| format!("Download failed: {e}"))
}

/// Télécharge `url` dans `dest` en calculant la somme au passage : le fichier (35 Mo) n'est
/// jamais relu en mémoire, et un transfert bloqué est abandonné au bout de `idle`.
pub async fn download_to_file(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    idle: Duration,
) -> Result<String, String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("Cannot write download: {e}"))?;
    let mut hasher = Sha256::new();
    loop {
        let chunk = tokio::time::timeout(idle, response.chunk())
            .await
            .map_err(|_| "Download failed: the transfer stalled".to_string())?
            .map_err(|e| format!("Download failed: {e}"))?;
        let Some(chunk) = chunk else { break };
        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Cannot write download: {e}"))?;
    }
    file.flush()
        .await
        .map_err(|e| format!("Cannot write download: {e}"))?;
    Ok(hex(&hasher.finalize()))
}

/// Met à jour le yt-dlp de `data_dir` depuis `base` (la page des releases). `current` est la
/// version du binaire en service : s'il s'agit déjà de la dernière, rien n'est téléchargé.
pub async fn run_update(
    base: &str,
    data_dir: &Path,
    current: Option<String>,
) -> Result<&'static str, String> {
    let tag = latest_tag(base).await?;
    if current.as_deref() == Some(tag.as_str()) {
        return Ok(UP_TO_DATE);
    }

    let dest = prepare_destination(data_dir)?;
    // Download next to the destination, verify, then rename: an interrupted download never
    // replaces a working binary.
    let tmp = data_dir.join("yt-dlp.download");

    let client = crate::net::download_client()?;
    let sums = fetch_text(&client, &asset_url(base, &tag, "SHA2-256SUMS")).await?;
    let expected =
        expected_sha256(&sums, asset_name()).ok_or("No checksum published for this platform")?;

    let url = asset_url(base, &tag, asset_name());
    let actual = match download_to_file(&client, &url, &tmp, IDLE_TIMEOUT).await {
        Ok(actual) => actual,
        Err(e) => {
            let _ = tokio::fs::remove_file(&tmp).await;
            return Err(e);
        }
    };
    if actual != expected {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err("Checksum mismatch: the downloaded yt-dlp was discarded".to_string());
    }

    make_executable(&tmp)?;
    tokio::fs::rename(&tmp, &dest)
        .await
        .map_err(|e| format!("Cannot install yt-dlp: {e}"))?;
    Ok(UPDATED)
}

async fn current_version(binary: &Path) -> Option<String> {
    let out = tokio::process::Command::new(binary)
        .arg("--version")
        .output()
        .await
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let _guard = UpdateGuard::acquire().ok_or("An update is already running")?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot find app data dir: {e}"))?;

    let current = match YtDlpBinary::find_with_app(&app) {
        Ok(bin) => current_version(bin.path()).await,
        Err(_) => None,
    };
    run_update(RELEASES, &data_dir, current)
        .await
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// Réponse d'un faux GitHub : statut, en-têtes supplémentaires, corps.
    type Route = (&'static str, Vec<(&'static str, String)>, Vec<u8>);

    /// Serveur HTTP minimal avec un chemin par route ; les chemins demandés sont journalisés.
    async fn github(routes: HashMap<String, Route>) -> (String, Arc<Mutex<Vec<String>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let log = Arc::new(Mutex::new(vec![]));
        let seen = log.clone();
        let routes = Arc::new(routes);
        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                let routes = routes.clone();
                let seen = seen.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 4096];
                    let n = socket.read(&mut buf).await.unwrap_or(0);
                    let request = String::from_utf8_lossy(&buf[..n]).into_owned();
                    let path = request.split_whitespace().nth(1).unwrap_or("/").to_string();
                    seen.lock().unwrap().push(path.clone());
                    let (status, headers, body) = routes.get(&path).cloned().unwrap_or((
                        "404 Not Found",
                        vec![],
                        b"missing".to_vec(),
                    ));
                    let mut head = format!("HTTP/1.1 {status}\r\nConnection: close\r\n");
                    for (k, v) in headers {
                        head.push_str(&format!("{k}: {v}\r\n"));
                    }
                    head.push_str(&format!("Content-Length: {}\r\n\r\n", body.len()));
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(&body).await;
                });
            }
        });
        (base, log)
    }

    fn release_routes(tag: &str, binary: &[u8], sum: &str) -> HashMap<String, Route> {
        let mut routes = HashMap::new();
        routes.insert(
            "/latest".to_string(),
            (
                "302 Found",
                vec![("Location", format!("/tag/{tag}"))],
                vec![],
            ),
        );
        routes.insert(
            format!("/download/{tag}/SHA2-256SUMS"),
            (
                "200 OK",
                vec![],
                format!("{sum}  {}\nffff  other\n", asset_name()).into_bytes(),
            ),
        );
        routes.insert(
            format!("/download/{tag}/{}", asset_name()),
            ("200 OK", vec![], binary.to_vec()),
        );
        routes
    }

    // ── fonctions pures ──────────────────────────────────────────────────────

    #[test]
    fn the_asset_targets_the_current_platform() {
        if cfg!(target_os = "macos") {
            assert_eq!(asset_name(), "yt-dlp_macos");
        } else {
            assert_eq!(asset_name(), "yt-dlp_linux");
        }
    }

    #[test]
    fn binary_and_checksums_come_from_the_same_release() {
        let sums = asset_url(RELEASES, "2026.10.21", "SHA2-256SUMS");
        let bin = asset_url(RELEASES, "2026.10.21", "yt-dlp_linux");

        assert_eq!(
            sums,
            "https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.21/SHA2-256SUMS"
        );
        assert_eq!(
            bin,
            "https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.21/yt-dlp_linux"
        );
    }

    #[test]
    fn the_destination_is_named_yt_dlp_inside_the_data_dir() {
        let dir = tempfile::tempdir().unwrap();

        let dest = prepare_destination(dir.path()).unwrap();

        assert_eq!(dest, dir.path().join("yt-dlp"));
    }

    #[test]
    fn a_missing_data_dir_is_created() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("a/b/c");

        prepare_destination(&nested).unwrap();

        assert!(nested.is_dir());
    }

    #[test]
    fn an_uncreatable_data_dir_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("not-a-dir");
        std::fs::write(&file, b"x").unwrap();

        let err = prepare_destination(&file.join("sub")).unwrap_err();

        assert!(err.starts_with("Cannot create data dir:"), "{err}");
    }

    #[cfg(unix)]
    #[test]
    fn the_downloaded_binary_becomes_executable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("yt-dlp");
        std::fs::write(&file, b"#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();

        make_executable(&file).unwrap();

        let mode = std::fs::metadata(&file).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o755);
    }

    #[cfg(unix)]
    #[test]
    fn a_missing_binary_cannot_be_made_executable() {
        let err = make_executable(Path::new("/nowhere/yt-dlp")).unwrap_err();

        assert!(err.starts_with("Cannot set permissions:"), "{err}");
    }

    #[test]
    fn the_expected_checksum_is_found_by_asset_name() {
        let sums = "AAA111  yt-dlp\nBBB222  yt-dlp_linux\nccc333 *yt-dlp_macos\n";

        assert_eq!(expected_sha256(sums, "yt-dlp_linux"), Some("bbb222".into()));
        assert_eq!(expected_sha256(sums, "yt-dlp_macos"), Some("ccc333".into()));
        assert_eq!(expected_sha256(sums, "yt-dlp.exe"), None);
    }

    #[test]
    fn the_sha256_of_abc_is_the_known_digest() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn the_tag_is_read_from_the_redirect_target() {
        assert_eq!(
            tag_from_url("https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19"),
            Some("2026.08.19")
        );
        assert_eq!(tag_from_url("/tag/2026.08.19"), Some("2026.08.19"));
        assert_eq!(
            tag_from_url("https://github.com/yt-dlp/yt-dlp/releases/latest"),
            None
        );
        assert_eq!(tag_from_url("https://x/tag/"), None);
        assert_eq!(tag_from_url("https://x/tag/a/b"), None);
    }

    #[test]
    fn only_one_update_runs_at_a_time() {
        let first = UpdateGuard::acquire();
        assert!(first.is_some());
        assert!(
            UpdateGuard::acquire().is_none(),
            "a second update must be refused"
        );

        drop(first);

        assert!(
            UpdateGuard::acquire().is_some(),
            "the guard is released on drop"
        );
    }

    // ── mise à jour de bout en bout, contre un faux GitHub ───────────────────

    #[tokio::test]
    async fn a_newer_release_is_downloaded_verified_and_installed() {
        let binary = b"#!/bin/sh\necho new\n";
        let (base, log) = github(release_routes("2026.11.01", binary, &sha256_hex(binary))).await;
        let dir = tempfile::tempdir().unwrap();

        let result = run_update(&base, dir.path(), Some("2026.10.21".into())).await;

        assert_eq!(result, Ok(UPDATED));
        assert_eq!(std::fs::read(dir.path().join("yt-dlp")).unwrap(), binary);
        assert!(!dir.path().join("yt-dlp.download").exists());
        // The sums and the binary are both taken from the tag read once.
        let seen = log.lock().unwrap().clone();
        assert!(seen.contains(&"/download/2026.11.01/SHA2-256SUMS".to_string()));
        assert!(seen.contains(&format!("/download/2026.11.01/{}", asset_name())));
        assert_eq!(seen.iter().filter(|p| *p == "/latest").count(), 1);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn the_installed_binary_is_executable() {
        use std::os::unix::fs::PermissionsExt;
        let binary = b"#!/bin/sh\n";
        let (base, _) = github(release_routes("2026.11.01", binary, &sha256_hex(binary))).await;
        let dir = tempfile::tempdir().unwrap();

        run_update(&base, dir.path(), None).await.unwrap();

        let mode = std::fs::metadata(dir.path().join("yt-dlp"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o111, 0o111);
    }

    #[tokio::test]
    async fn nothing_is_downloaded_when_the_binary_is_already_the_latest() {
        let binary = b"x";
        let (base, log) = github(release_routes("2026.10.21", binary, &sha256_hex(binary))).await;
        let dir = tempfile::tempdir().unwrap();

        let result = run_update(&base, dir.path(), Some("2026.10.21".into())).await;

        assert_eq!(result, Ok(UP_TO_DATE));
        assert!(!dir.path().join("yt-dlp").exists());
        assert_eq!(log.lock().unwrap().as_slice(), ["/latest"]);
    }

    #[tokio::test]
    async fn a_wrong_checksum_discards_the_download_and_keeps_the_old_binary() {
        let (base, _) = github(release_routes("2026.11.01", b"tampered", &"0".repeat(64))).await;
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("yt-dlp"), b"old").unwrap();

        let err = run_update(&base, dir.path(), None).await.unwrap_err();

        assert!(err.starts_with("Checksum mismatch"), "{err}");
        assert_eq!(std::fs::read(dir.path().join("yt-dlp")).unwrap(), b"old");
        assert!(!dir.path().join("yt-dlp.download").exists());
    }

    #[tokio::test]
    async fn a_missing_checksum_for_the_platform_is_refused() {
        let mut routes = release_routes("2026.11.01", b"x", "aa");
        routes.insert(
            "/download/2026.11.01/SHA2-256SUMS".to_string(),
            ("200 OK", vec![], b"ff  something-else\n".to_vec()),
        );
        let (base, _) = github(routes).await;
        let dir = tempfile::tempdir().unwrap();

        let err = run_update(&base, dir.path(), None).await.unwrap_err();

        assert_eq!(err, "No checksum published for this platform");
    }

    #[tokio::test]
    async fn a_failed_download_reports_the_status_and_leaves_no_file() {
        let mut routes = release_routes("2026.11.01", b"x", &sha256_hex(b"x"));
        routes.remove(&format!("/download/2026.11.01/{}", asset_name()));
        let (base, _) = github(routes).await;
        let dir = tempfile::tempdir().unwrap();

        let err = run_update(&base, dir.path(), None).await.unwrap_err();

        assert!(err.starts_with("Download failed: HTTP 404"), "{err}");
        assert!(!dir.path().join("yt-dlp.download").exists());
        assert!(!dir.path().join("yt-dlp").exists());
    }

    #[tokio::test]
    async fn an_unreadable_redirect_means_the_release_is_unknown() {
        let (base, _) = github(HashMap::new()).await;
        let dir = tempfile::tempdir().unwrap();

        let err = run_update(&base, dir.path(), None).await.unwrap_err();

        assert_eq!(err, "Cannot determine the latest yt-dlp release");
    }

    #[tokio::test]
    async fn a_stalled_transfer_is_abandoned() {
        // The server announces a body and never sends it.
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 1024];
            let _ = socket.read(&mut buf).await;
            let _ = socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\npartial")
                .await;
            tokio::time::sleep(Duration::from_secs(30)).await;
        });
        crate::net::install_tls_provider();
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("f");

        let err = download_to_file(
            &reqwest::Client::new(),
            &format!("http://{addr}/f"),
            &dest,
            Duration::from_millis(300),
        )
        .await
        .unwrap_err();

        assert_eq!(err, "Download failed: the transfer stalled");
    }

    #[tokio::test]
    async fn the_checksum_is_computed_while_streaming() {
        let body = vec![7u8; 200_000];
        let mut routes = HashMap::new();
        routes.insert("/f".to_string(), ("200 OK", vec![], body.clone()));
        let (base, _) = github(routes).await;
        crate::net::install_tls_provider();
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("f");

        let sum = download_to_file(
            &reqwest::Client::new(),
            &format!("{base}/f"),
            &dest,
            Duration::from_secs(5),
        )
        .await
        .unwrap();

        assert_eq!(sum, sha256_hex(&body));
        assert_eq!(std::fs::read(&dest).unwrap(), body);
    }
}
