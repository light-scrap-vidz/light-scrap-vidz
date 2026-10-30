use super::fetch_slots::{run_cancellable, FetchSlots};
use crate::ytdlp::{builder::InfoCommand, finder::YtDlpBinary, validate};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, rename = "VideoInfo")]
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
    slots: tauri::State<'_, FetchSlots>,
    url: String,
    cookies_browser: Option<String>,
) -> Result<VideoInfoResponse, String> {
    validate::url(&url)?;
    validate::cookies_browser(&cookies_browser)?;
    let binary = YtDlpBinary::find_with_app(&app)?;

    let cmd = InfoCommand {
        binary: binary.path().to_path_buf(),
        url,
        cookies_browser,
    }
    .build();
    let output = run_cancellable(&slots, "video", cmd).await?;

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
    }

    #[test]
    fn only_the_id_and_title_are_required() {
        // yt-dlp omet les champs vides selon l'extracteur : tout le reste a un défaut.
        let info = parse_video_info(r#"{"id": "x", "title": "T"}"#).unwrap();

        assert_eq!(info.thumbnail, "");
        assert_eq!(info.duration, 0.0);
        assert_eq!(info.uploader, "");
    }

    #[test]
    fn a_missing_title_is_rejected() {
        let err = parse_video_info(r#"{"id": "x"}"#).unwrap_err();

        assert!(err.starts_with("Failed to parse video info:"), "{err}");
    }

    #[test]
    fn the_heavy_format_list_is_ignored_while_decoding() {
        // Several hundred entries on a real video: serde skips what the struct lacks.
        let json = r#"{"id":"x","title":"T","formats":[
            {"format_id":"18","height":null,"filesize":null,"vcodec":null,"acodec":null}
        ]}"#;

        let info = parse_video_info(json).unwrap();

        assert_eq!(info.id, "x");
        assert!(serde_json::to_value(&info)
            .unwrap()
            .get("formats")
            .is_none());
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
