use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;

use crate::ytdlp::{
    builder::{DownloadCommand, PlaylistDownloadCommand, Quality},
    finder::YtDlpBinary,
    parser::{parse_destination_line, parse_playlist_item_line, parse_progress_line},
};

pub type DownloadRegistry = Arc<Mutex<HashMap<String, Child>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub download_id: String,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub filename: String,
    pub current_item: Option<u32>,
    pub total_items: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletePayload {
    pub download_id: String,
    pub filepath: String,
}

/// Suit la sortie de yt-dlp ligne à ligne et fabrique les événements de progression.
///
/// Extrait de la boucle asynchrone de `start_download` : le processus externe et
/// l'émission Tauri restent dans la commande, la logique de lecture est ici et se teste
/// en injectant simplement des lignes.
pub struct ProgressTracker {
    download_id: String,
    last_filename: String,
    current_item: Option<u32>,
    total_items: Option<u32>,
}

impl ProgressTracker {
    pub fn new(download_id: String) -> Self {
        Self {
            download_id,
            last_filename: String::new(),
            current_item: None,
            total_items: None,
        }
    }

    /// Consomme une ligne ; renvoie un payload uniquement pour les lignes de progression.
    /// Les lignes « Destination » et « item n of m » ne font que mettre à jour l'état.
    pub fn consume(&mut self, line: &str) -> Option<ProgressPayload> {
        if let Some(dest) = parse_destination_line(line) {
            self.last_filename = dest;
        }
        if let Some(pi) = parse_playlist_item_line(line) {
            self.current_item = Some(pi.current_item);
            self.total_items = Some(pi.total_items);
        }
        let p = parse_progress_line(line)?;
        Some(ProgressPayload {
            download_id: self.download_id.clone(),
            percent: p.percent,
            speed: p.speed,
            eta: p.eta,
            filename: basename(&self.last_filename),
            current_item: self.current_item,
            total_items: self.total_items,
        })
    }

    pub fn last_filename(&self) -> &str {
        &self.last_filename
    }
}

/// Dernier segment d'un chemin, chaîne vide si le chemin l'est.
pub fn basename(path: &str) -> String {
    path.split('/').next_back().unwrap_or("").to_string()
}

/// Ce que l'événement « terminé » désigne : le fichier produit, ou le dossier de sortie
/// pour une playlist (plusieurs fichiers) ou quand yt-dlp n'a annoncé aucune destination.
pub fn completed_path(is_playlist: bool, last_filename: &str, output_dir: &str) -> String {
    if is_playlist || last_filename.is_empty() {
        output_dir.to_string()
    } else {
        last_filename.to_string()
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn start_download(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadRegistry>,
    url: String,
    output_dir: String,
    quality: String,
    download_id: String,
    playlist_end: Option<u32>,
    cookies_browser: Option<String>,
    audio_only: bool,
) -> Result<(), String> {
    let binary = YtDlpBinary::find_with_app(&app)?;
    let q = Quality::from_str(&quality);
    let binary_path = binary.path().to_path_buf();
    let output_dir_clone = output_dir.clone();

    let mut process = match playlist_end {
        None => {
            let cmd = DownloadCommand {
                binary: binary_path,
                url,
                output_dir: PathBuf::from(&output_dir),
                quality: q,
                cookies_browser,
                audio_only,
            };
            tokio::process::Command::from(cmd.build())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?
        }
        Some(n) => {
            let end = if n == 0 { None } else { Some(n) };
            let cmd = PlaylistDownloadCommand {
                binary: binary_path,
                url,
                output_dir: PathBuf::from(&output_dir),
                quality: q,
                playlist_end: end,
                cookies_browser,
                audio_only,
            };
            tokio::process::Command::from(cmd.build())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?
        }
    };

    let stdout = process.stdout.take().unwrap();
    let stderr = process.stderr.take().unwrap();

    {
        let mut registry = state.lock().await;
        registry.insert(download_id.clone(), process);
    }

    let id = download_id.clone();
    let app_handle = app.clone();
    let registry = state.inner().clone();
    let is_playlist = playlist_end.is_some();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut tracker = ProgressTracker::new(id.clone());

        while let Ok(Some(line)) = reader.next_line().await {
            if let Some(payload) = tracker.consume(&line) {
                let _ = app_handle.emit("download://progress", payload);
            }
        }
        let last_filename = tracker.last_filename().to_string();

        // Drain stderr to prevent pipe blocking
        let mut err_reader = BufReader::new(stderr).lines();
        while err_reader.next_line().await.ok().flatten().is_some() {}

        let was_cancelled = {
            let mut reg = registry.lock().await;
            if let Some(child) = reg.remove(&id) {
                drop(child);
                false
            } else {
                true
            }
        };

        if !was_cancelled {
            let filepath = completed_path(is_playlist, &last_filename, &output_dir_clone);
            let _ = app_handle.emit(
                "download://complete",
                CompletePayload {
                    download_id: id.clone(),
                    filepath,
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, DownloadRegistry>,
    download_id: String,
) -> Result<(), String> {
    let mut registry = state.lock().await;
    if let Some(mut child) = registry.remove(&download_id) {
        let _ = child.kill().await;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DEST: &str = "[download] Destination: /home/me/Videos/Clip.f137.mp4";
    const PROGRESS: &str = "[download]  47.3% of   18.23MiB at   1.23MiB/s ETA 00:09";

    fn tracker() -> ProgressTracker {
        ProgressTracker::new("dl-1".to_string())
    }

    // ── basename ─────────────────────────────────────────────────────────────

    #[test]
    fn the_basename_is_the_last_path_segment() {
        assert_eq!(basename("/home/me/Videos/Clip.mp4"), "Clip.mp4");
    }

    #[test]
    fn a_bare_filename_is_its_own_basename() {
        assert_eq!(basename("Clip.mp4"), "Clip.mp4");
    }

    #[test]
    fn an_empty_path_has_an_empty_basename() {
        assert_eq!(basename(""), "");
    }

    #[test]
    fn a_trailing_slash_yields_an_empty_basename() {
        assert_eq!(basename("/home/me/Videos/"), "");
    }

    // ── chemin final ─────────────────────────────────────────────────────────

    #[test]
    fn a_single_download_reports_the_file_it_produced() {
        assert_eq!(
            completed_path(false, "/out/Clip.mp4", "/out"),
            "/out/Clip.mp4"
        );
    }

    #[test]
    fn a_playlist_reports_the_output_directory() {
        assert_eq!(completed_path(true, "/out/Clip.mp4", "/out"), "/out");
    }

    #[test]
    fn a_download_with_no_announced_destination_falls_back_to_the_directory() {
        assert_eq!(completed_path(false, "", "/out"), "/out");
    }

    // ── suivi de progression ─────────────────────────────────────────────────

    #[test]
    fn a_progress_line_produces_a_payload() {
        let mut t = tracker();

        let payload = t.consume(PROGRESS).unwrap();

        assert_eq!(payload.download_id, "dl-1");
        assert!((payload.percent - 47.3).abs() < 0.01);
        assert!(payload.speed.contains("MiB/s"));
        assert_eq!(payload.eta, "00:09");
    }

    #[test]
    fn a_destination_line_produces_no_payload_but_names_the_file() {
        let mut t = tracker();

        assert!(t.consume(DEST).is_none());

        assert_eq!(t.last_filename(), "/home/me/Videos/Clip.f137.mp4");
        assert_eq!(t.consume(PROGRESS).unwrap().filename, "Clip.f137.mp4");
    }

    #[test]
    fn the_payload_carries_only_the_basename() {
        let mut t = tracker();
        t.consume(DEST);

        let payload = t.consume(PROGRESS).unwrap();

        assert_eq!(payload.filename, "Clip.f137.mp4");
    }

    #[test]
    fn the_filename_is_empty_until_a_destination_is_announced() {
        let mut t = tracker();

        assert_eq!(t.consume(PROGRESS).unwrap().filename, "");
    }

    #[test]
    fn a_merge_line_replaces_the_destination() {
        let mut t = tracker();
        t.consume(DEST);

        t.consume(r#"[Merger] Merging formats into "/home/me/Videos/Clip.mp4""#);

        assert_eq!(t.last_filename(), "/home/me/Videos/Clip.mp4");
        assert_eq!(t.consume(PROGRESS).unwrap().filename, "Clip.mp4");
    }

    #[test]
    fn a_playlist_item_line_sets_the_counters() {
        let mut t = tracker();

        assert!(t.consume("[download] Downloading item 3 of 12").is_none());

        let payload = t.consume(PROGRESS).unwrap();
        assert_eq!(payload.current_item, Some(3));
        assert_eq!(payload.total_items, Some(12));
    }

    #[test]
    fn the_counters_stay_unset_outside_a_playlist() {
        let mut t = tracker();

        let payload = t.consume(PROGRESS).unwrap();

        assert_eq!(payload.current_item, None);
        assert_eq!(payload.total_items, None);
    }

    #[test]
    fn the_counters_follow_the_playlist_as_it_advances() {
        let mut t = tracker();
        t.consume("[download] Downloading item 1 of 3");
        assert_eq!(t.consume(PROGRESS).unwrap().current_item, Some(1));

        t.consume("[download] Downloading item 2 of 3");

        assert_eq!(t.consume(PROGRESS).unwrap().current_item, Some(2));
    }

    #[test]
    fn unrelated_lines_are_ignored() {
        let mut t = tracker();

        for line in [
            "[youtube] Extracting URL: https://y.tld/watch?v=x",
            "[info] Downloading 1 format(s): 137+140",
            "",
            "WARNING: unable to obtain file audio codec",
        ] {
            assert!(t.consume(line).is_none(), "{line}");
        }
        assert_eq!(t.last_filename(), "");
    }

    #[test]
    fn a_full_single_download_session_reads_end_to_end() {
        let mut t = tracker();
        let lines = [
            "[youtube] Extracting URL: https://y.tld/watch?v=x",
            DEST,
            "[download]   0.0% of   18.23MiB at  Unknown B/s ETA Unknown",
            PROGRESS,
            "[download] 100% of   18.23MiB at   2.00MiB/s ETA 00:00",
            r#"[Merger] Merging formats into "/home/me/Videos/Clip.mp4""#,
        ];

        let payloads: Vec<_> = lines.iter().filter_map(|l| t.consume(l)).collect();

        assert_eq!(payloads.len(), 3);
        assert_eq!(payloads[0].eta, "Unknown");
        assert!((payloads[2].percent - 100.0).abs() < 0.01);
        assert_eq!(
            completed_path(false, t.last_filename(), "/out"),
            "/home/me/Videos/Clip.mp4"
        );
    }

    // ── annulation ───────────────────────────────────────────────────────────

    use tauri::Manager;

    fn registry_app() -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        let registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));
        app.manage(registry);
        app
    }

    /// Processus long, tenant lieu de yt-dlp en cours.
    fn spawn_sleeper() -> Child {
        tokio::process::Command::new("sleep")
            .arg("30")
            .kill_on_drop(true)
            .spawn()
            .expect("`sleep` indisponible")
    }

    #[tokio::test]
    async fn cancelling_kills_the_process_and_drops_it_from_the_registry() {
        let app = registry_app();
        let state = app.state::<DownloadRegistry>();
        let mut child = spawn_sleeper();
        let pid = child.id();
        assert!(
            child.try_wait().unwrap().is_none(),
            "le processus doit tourner"
        );
        state.lock().await.insert("dl-1".to_string(), child);

        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();

        assert!(state.lock().await.is_empty());
        assert!(pid.is_some());
    }

    #[tokio::test]
    async fn cancelling_an_unknown_download_is_a_no_op() {
        let app = registry_app();
        let state = app.state::<DownloadRegistry>();
        state
            .lock()
            .await
            .insert("dl-1".to_string(), spawn_sleeper());

        cancel_download(app.state::<DownloadRegistry>(), "autre".to_string())
            .await
            .unwrap();

        // L'entrée existante n'est pas touchée.
        assert_eq!(state.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn cancelling_twice_is_harmless() {
        let app = registry_app();
        app.state::<DownloadRegistry>()
            .lock()
            .await
            .insert("dl-1".to_string(), spawn_sleeper());

        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();
        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();

        assert!(app.state::<DownloadRegistry>().lock().await.is_empty());
    }
}
