use serde::{Deserialize, Serialize};
use std::process::Stdio;

use crate::ytdlp::{builder::InfoCommand, finder::YtDlpBinary};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FormatInfo {
    pub format_id: String,
    #[serde(default)]
    pub ext: String,
    pub height: Option<i32>,
    pub filesize: Option<i64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfoResponse {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub thumbnail: String,
    #[serde(default)]
    pub duration: f64,
    #[serde(default)]
    pub uploader: String,
    #[serde(default)]
    pub webpage_url: String,
    #[serde(default)]
    pub extractor: String,
    #[serde(default)]
    pub formats: Vec<FormatInfo>,
}

/// Traduit un échec de yt-dlp en message affichable.
pub fn ytdlp_error(stderr: &[u8]) -> String {
    format!("yt-dlp error: {}", String::from_utf8_lossy(stderr).trim())
}

/// Décode la réponse JSON de `yt-dlp --dump-json`. Extrait de la commande pour que le
/// contrat de désérialisation soit testable sans lancer yt-dlp.
pub fn parse_video_info(json: &str) -> Result<VideoInfoResponse, String> {
    serde_json::from_str::<VideoInfoResponse>(json)
        .map_err(|e| format!("Failed to parse video info: {e}"))
}

#[tauri::command]
pub async fn fetch_video_info(
    app: tauri::AppHandle,
    url: String,
    cookies_browser: Option<String>,
) -> Result<VideoInfoResponse, String> {
    let binary = YtDlpBinary::find_with_app(&app)?;

    let cmd = InfoCommand {
        binary: binary.path().to_path_buf(),
        url,
        cookies_browser,
    }
    .build();
    let output = tokio::process::Command::from(cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;

    if !output.status.success() {
        return Err(ytdlp_error(&output.stderr));
    }

    parse_video_info(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_full_response_is_decoded() {
        let json = r#"{
            "id": "abc123",
            "title": "Ma vidéo",
            "thumbnail": "https://img/1.jpg",
            "duration": 212.5,
            "uploader": "Chaine",
            "webpage_url": "https://y.tld/watch?v=abc123",
            "extractor": "youtube",
            "formats": [
                {"format_id": "137", "ext": "mp4", "height": 1080, "filesize": 12345,
                 "vcodec": "avc1", "acodec": "none"}
            ]
        }"#;

        let info = parse_video_info(json).unwrap();

        assert_eq!(info.id, "abc123");
        assert_eq!(info.title, "Ma vidéo");
        assert_eq!(info.duration, 212.5);
        assert_eq!(info.extractor, "youtube");
        assert_eq!(info.formats.len(), 1);
        assert_eq!(info.formats[0].height, Some(1080));
        assert_eq!(info.formats[0].acodec.as_deref(), Some("none"));
    }

    #[test]
    fn only_the_id_and_title_are_required() {
        // yt-dlp omet les champs vides selon l'extracteur : tout le reste a un défaut.
        let info = parse_video_info(r#"{"id": "x", "title": "T"}"#).unwrap();

        assert_eq!(info.thumbnail, "");
        assert_eq!(info.duration, 0.0);
        assert_eq!(info.uploader, "");
        assert!(info.formats.is_empty());
    }

    #[test]
    fn a_missing_title_is_rejected() {
        let err = parse_video_info(r#"{"id": "x"}"#).unwrap_err();

        assert!(err.starts_with("Failed to parse video info:"), "{err}");
    }

    #[test]
    fn nullable_format_fields_are_accepted() {
        let json = r#"{"id":"x","title":"T","formats":[
            {"format_id":"18","height":null,"filesize":null,"vcodec":null,"acodec":null}
        ]}"#;

        let info = parse_video_info(json).unwrap();

        assert_eq!(info.formats[0].ext, "");
        assert_eq!(info.formats[0].height, None);
        assert_eq!(info.formats[0].filesize, None);
    }

    #[test]
    fn a_malformed_payload_is_rejected() {
        assert!(parse_video_info("pas du json").is_err());
        assert!(parse_video_info("").is_err());
        assert!(parse_video_info("[]").is_err());
    }

    #[test]
    fn a_failure_quotes_the_trimmed_stderr() {
        let msg = ytdlp_error(b"  ERROR: Video unavailable\n");

        assert_eq!(msg, "yt-dlp error: ERROR: Video unavailable");
    }

    #[test]
    fn invalid_utf8_in_stderr_does_not_panic() {
        assert!(ytdlp_error(&[0xff, 0xfe]).starts_with("yt-dlp error:"));
    }
}
