use std::process::Stdio;

/// Type MIME déduit des premiers octets. Séparé de la commande pour être testable
/// sans appel réseau.
pub fn mime_from_magic(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(b"GIF") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") {
        "image/webp"
    } else {
        "image/jpeg"
    }
}

pub fn data_url(mime: &str, b64: &str) -> String {
    format!("data:{mime};base64,{b64}")
}

/// Plafond de taille du téléchargement (5 Mio) : une vignette au-delà est forcément
/// autre chose, et on ne veut pas la charger en mémoire.
pub const MAX_FILESIZE: &str = "5242880";

/// En-têtes empruntés à Safari iOS : Instagram sert des 403 aux clients non reconnus.
const USER_AGENT: &str = "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const REFERER: &str = "Referer: https://www.instagram.com/";

/// Arguments passés à curl pour récupérer une vignette. Séparé de la commande pour que
/// les garde-fous (timeout, plafond, en-têtes) soient vérifiables.
pub fn curl_args(url: &str) -> Vec<&str> {
    vec![
        "-L",
        "-s",
        "-f",
        "--max-time",
        "10",
        "--max-filesize",
        MAX_FILESIZE,
        "-H",
        USER_AGENT,
        "-H",
        REFERER,
        "-o",
        "-",
        url,
    ]
}

#[tauri::command]
pub async fn fetch_thumbnail(url: String) -> Result<String, String> {
    if url.is_empty() {
        return Err("No URL".to_string());
    }

    let output = tokio::process::Command::new("curl")
        .args(curl_args(&url))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("curl error: {e}"))?;

    if !output.status.success() || output.stdout.is_empty() {
        return Err("Failed to fetch thumbnail".to_string());
    }

    use std::io::Write;
    let mut enc = std::process::Command::new("base64")
        .arg("--wrap=0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("base64 error: {e}"))?;

    if let Some(stdin) = enc.stdin.as_mut() {
        stdin.write_all(&output.stdout).ok();
    }
    let b64 = enc.wait_with_output().map_err(|e| e.to_string())?;
    let b64_str = String::from_utf8_lossy(&b64.stdout);

    Ok(data_url(mime_from_magic(&output.stdout), &b64_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_png_is_recognised_by_its_signature() {
        assert_eq!(mime_from_magic(b"\x89PNG\r\n\x1a\n rest"), "image/png");
    }

    #[test]
    fn a_gif_is_recognised_by_its_signature() {
        assert_eq!(mime_from_magic(b"GIF89a..."), "image/gif");
        assert_eq!(mime_from_magic(b"GIF87a..."), "image/gif");
    }

    #[test]
    fn a_riff_container_is_read_as_webp() {
        assert_eq!(mime_from_magic(b"RIFF\x00\x00\x00\x00WEBP"), "image/webp");
    }

    #[test]
    fn anything_else_defaults_to_jpeg() {
        assert_eq!(mime_from_magic(b"\xff\xd8\xff\xe0"), "image/jpeg");
        assert_eq!(mime_from_magic(b"whatever"), "image/jpeg");
    }

    #[test]
    fn an_empty_body_defaults_to_jpeg() {
        assert_eq!(mime_from_magic(b""), "image/jpeg");
    }

    #[test]
    fn a_truncated_signature_does_not_match() {
        // Plus court que la signature PNG : ne doit pas paniquer ni matcher.
        assert_eq!(mime_from_magic(b"\x89P"), "image/jpeg");
    }

    #[test]
    fn the_data_url_carries_the_mime_and_the_payload() {
        assert_eq!(data_url("image/png", "QUJD"), "data:image/png;base64,QUJD");
    }

    #[test]
    fn the_curl_arguments_carry_the_url_last() {
        let args = curl_args("https://cdn/thumb.jpg");

        assert_eq!(args.last(), Some(&"https://cdn/thumb.jpg"));
    }

    #[test]
    fn the_download_is_capped_in_time_and_size() {
        let args = curl_args("https://cdn/x.jpg");

        let after = |flag: &str| {
            args.iter()
                .position(|a| *a == flag)
                .map(|i| args[i + 1])
                .unwrap_or_else(|| panic!("{flag} absent"))
        };
        assert_eq!(after("--max-time"), "10");
        assert_eq!(after("--max-filesize"), "5242880");
    }

    #[test]
    fn redirects_are_followed_and_errors_surface() {
        let args = curl_args("https://cdn/x.jpg");

        assert!(
            args.contains(&"-L"),
            "les redirections doivent être suivies"
        );
        assert!(args.contains(&"-f"), "un 4xx doit faire échouer curl");
        assert!(
            args.contains(&"-s"),
            "pas de barre de progression sur stdout"
        );
    }

    #[test]
    fn the_body_goes_to_stdout() {
        let args = curl_args("https://cdn/x.jpg");
        let i = args.iter().position(|a| *a == "-o").unwrap();

        assert_eq!(args[i + 1], "-");
    }

    #[test]
    fn the_instagram_headers_are_sent() {
        let args = curl_args("https://cdn/x.jpg");
        let headers: Vec<&&str> = args
            .iter()
            .enumerate()
            .filter(|(i, _)| *i > 0 && args[i - 1] == "-H")
            .map(|(_, a)| a)
            .collect();

        assert_eq!(headers.len(), 2);
        assert!(headers.iter().any(|h| h.starts_with("User-Agent: ")));
        assert!(headers.iter().any(|h| h.contains("instagram.com")));
    }

    #[tokio::test]
    async fn an_empty_url_is_refused_without_touching_the_network() {
        assert_eq!(fetch_thumbnail(String::new()).await.unwrap_err(), "No URL");
    }
}
