use serde::{Deserialize, Serialize};
use std::process::Stdio;

use crate::ytdlp::{builder::PlaylistInfoCommand, finder::YtDlpBinary};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PlaylistEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistInfoResponse {
    #[serde(rename = "_type", default)]
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub uploader: String,
    pub playlist_count: Option<u32>,
    #[serde(default)]
    pub entries: Vec<PlaylistEntry>,
}

/// Décode la réponse JSON de `yt-dlp --flat-playlist --dump-single-json`. Extrait de la
/// commande pour que le contrat de désérialisation soit testable sans lancer yt-dlp.
pub fn parse_playlist_info(json: &str) -> Result<PlaylistInfoResponse, String> {
    serde_json::from_str::<PlaylistInfoResponse>(json)
        .map_err(|e| format!("Failed to parse playlist info: {e}"))
}

#[tauri::command]
pub async fn fetch_playlist_info(
    app: tauri::AppHandle,
    url: String,
    cookies_browser: Option<String>,
) -> Result<PlaylistInfoResponse, String> {
    let binary = YtDlpBinary::find_with_app(&app)?;

    let cmd = PlaylistInfoCommand {
        binary: binary.path().to_path_buf(),
        url,
        peek: 20,
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
        return Err(crate::commands::fetch_info::ytdlp_error(&output.stderr));
    }

    parse_playlist_info(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_playlist_response_is_decoded() {
        let json = r#"{
            "_type": "playlist",
            "title": "Ma liste",
            "uploader": "Chaine",
            "playlist_count": 42,
            "entries": [
                {"id": "a", "title": "Un", "url": "https://y.tld/a"},
                {"id": "b", "title": "Deux", "url": "https://y.tld/b"}
            ]
        }"#;

        let info = parse_playlist_info(json).unwrap();

        assert_eq!(info.kind, "playlist");
        assert_eq!(info.title, "Ma liste");
        assert_eq!(info.uploader, "Chaine");
        assert_eq!(info.playlist_count, Some(42));
        assert_eq!(info.entries.len(), 2);
        assert_eq!(info.entries[1].title, "Deux");
    }

    #[test]
    fn the_type_field_is_read_from_its_underscored_name() {
        let info = parse_playlist_info(r#"{"_type": "video"}"#).unwrap();

        assert_eq!(info.kind, "video");
    }

    #[test]
    fn every_field_has_a_default() {
        // Une URL qui n'est pas une playlist renvoie un objet très pauvre.
        let info = parse_playlist_info("{}").unwrap();

        assert_eq!(info.kind, "");
        assert_eq!(info.title, "");
        assert_eq!(info.playlist_count, None);
        assert!(info.entries.is_empty());
    }

    #[test]
    fn an_entry_missing_its_fields_is_still_accepted() {
        let info = parse_playlist_info(r#"{"entries": [{}]}"#).unwrap();

        assert_eq!(info.entries.len(), 1);
        assert_eq!(info.entries[0].id, "");
        assert_eq!(info.entries[0].url, "");
    }

    #[test]
    fn an_unknown_playlist_count_stays_none() {
        let info = parse_playlist_info(r#"{"playlist_count": null}"#).unwrap();

        assert_eq!(info.playlist_count, None);
    }

    #[test]
    fn a_malformed_payload_is_rejected() {
        let err = parse_playlist_info("pas du json").unwrap_err();

        assert!(err.starts_with("Failed to parse playlist info:"), "{err}");
    }
}
