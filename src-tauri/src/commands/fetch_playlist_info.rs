use super::fetch_slots::{run_cancellable, FetchSlots};
use crate::ytdlp::{builder::PlaylistInfoCommand, finder::YtDlpBinary, validate};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, Default, TS)]
#[ts(export)]
pub struct PlaylistEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export, rename = "PlaylistInfo")]
pub struct PlaylistInfoResponse {
    #[serde(rename(deserialize = "_type", serialize = "kind"), default)]
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub uploader: String,
    pub playlist_count: Option<u32>,
    #[serde(default)]
    pub entries: Vec<PlaylistEntry>,
}

/// Nombre d'entrées lues par page : assez pour connaître `playlist_count` sans parcourir un
/// profil entier.
pub const PAGE_SIZE: u32 = 20;

/// Fenêtre `[start, end]` (à partir de 1) demandée à yt-dlp ; par défaut la première page.
pub fn page_window(start: Option<u32>, end: Option<u32>) -> (u32, u32) {
    let start = start.unwrap_or(1).max(1);
    let end = end.unwrap_or(start + PAGE_SIZE - 1).max(start);
    // A page never asks for more than PAGE_SIZE entries, whatever the webview says.
    (start, end.min(start + PAGE_SIZE - 1))
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
    slots: tauri::State<'_, FetchSlots>,
    url: String,
    cookies_browser: Option<String>,
    start: Option<u32>,
    end: Option<u32>,
) -> Result<PlaylistInfoResponse, String> {
    validate::url(&url)?;
    validate::cookies_browser(&cookies_browser)?;
    let binary = YtDlpBinary::find_with_app(&app)?;
    let (start, end) = page_window(start, end);

    let cmd = PlaylistInfoCommand {
        binary: binary.path().to_path_buf(),
        url,
        start,
        end,
        cookies_browser,
    }
    .build();

    let output = run_cancellable(&slots, "playlist", cmd).await?;

    if !output.status.success() {
        return Err(crate::commands::fetch_info::ytdlp_error(&output.stderr));
    }

    parse_playlist_info(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_default_window_is_the_first_page() {
        assert_eq!(page_window(None, None), (1, 20));
    }

    #[test]
    fn the_next_page_starts_where_the_previous_one_ended() {
        assert_eq!(page_window(Some(21), Some(40)), (21, 40));
        assert_eq!(page_window(Some(21), None), (21, 40));
    }

    #[test]
    fn a_window_is_never_empty_nor_larger_than_a_page() {
        assert_eq!(page_window(Some(0), Some(0)), (1, 1));
        assert_eq!(page_window(Some(5), Some(2)), (5, 5));
        assert_eq!(page_window(Some(1), Some(5000)), (1, 20));
    }

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
    fn the_frontend_receives_the_kind_under_its_own_name() {
        let info = parse_playlist_info(r#"{"_type": "playlist"}"#).unwrap();

        let sent = serde_json::to_value(&info).unwrap();

        assert_eq!(sent["kind"], "playlist");
        assert!(sent.get("_type").is_none());
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
