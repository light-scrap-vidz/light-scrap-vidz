use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;

use crate::ytdlp::parser::{parse_destination_line, parse_playlist_item_line, parse_progress_line};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub download_id: String,
    pub message: String,
}

/// Taille de stderr conservée pour le message d'erreur (les lignes `ERROR:` sont toujours gardées).
const STDERR_KEEP: usize = 8 * 1024;

/// Message affiché quand yt-dlp échoue ; jamais vide.
pub fn error_message(stderr: &str) -> String {
    let trimmed = stderr.trim();
    if trimmed.is_empty() {
        "yt-dlp exited with an error".to_string()
    } else {
        trimmed.to_string()
    }
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

pub const EVENT_PROGRESS: &str = "download://progress";
pub const EVENT_COMPLETE: &str = "download://complete";
pub const EVENT_ERROR: &str = "download://error";

/// Ce que la tâche de suivi remonte ; la commande Tauri le traduit en événements.
#[derive(Debug, Clone)]
pub enum DownloadEvent {
    Progress(ProgressPayload),
    Complete(CompletePayload),
    Error(ErrorPayload),
}

/// Supprime les fichiers temporaires d'un téléchargement annulé.
pub fn remove_partial_files(last_filename: &str) {
    if last_filename.is_empty() {
        return;
    }
    for suffix in [".part", ".ytdl"] {
        let _ = std::fs::remove_file(format!("{last_filename}{suffix}"));
    }
}

/// Suit un processus yt-dlp jusqu'à sa fin. Séparé de la commande Tauri pour pouvoir être
/// testé avec un faux yt-dlp : lecture concurrente de stdout et stderr (sinon un pipe plein
/// bloque le processus), code retour, annulation.
pub async fn drive_download(
    stdout: tokio::process::ChildStdout,
    stderr: tokio::process::ChildStderr,
    id: String,
    is_playlist: bool,
    output_dir: String,
    registry: DownloadRegistry,
    emit: impl Fn(DownloadEvent) + Send + 'static,
) {
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        let mut raw = Vec::new();
        let mut text = String::new();
        loop {
            raw.clear();
            match reader.read_until(b'\n', &mut raw).await {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let line = String::from_utf8_lossy(&raw);
                    if line.starts_with("ERROR:") || text.len() < STDERR_KEEP {
                        text.push_str(&line);
                    }
                }
            }
        }
        text
    });

    let mut reader = BufReader::new(stdout);
    let mut raw = Vec::new();
    let mut tracker = ProgressTracker::new(id.clone());
    loop {
        raw.clear();
        match reader.read_until(b'\n', &mut raw).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&raw);
                if let Some(payload) = tracker.consume(line.trim_end()) {
                    emit(DownloadEvent::Progress(payload));
                }
            }
        }
    }
    let last_filename = tracker.last_filename().to_string();
    let stderr_text = stderr_task.await.unwrap_or_default();

    // A cancelled download has already been removed from the registry.
    let Some(mut child) = registry.lock().await.remove(&id) else {
        remove_partial_files(&last_filename);
        return;
    };
    let succeeded = matches!(child.wait().await, Ok(status) if status.success());

    if succeeded {
        emit(DownloadEvent::Complete(CompletePayload {
            download_id: id,
            filepath: completed_path(is_playlist, &last_filename, &output_dir),
        }));
    } else {
        emit(DownloadEvent::Error(ErrorPayload {
            download_id: id,
            message: error_message(&stderr_text),
        }));
    }
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

    #[test]
    fn an_empty_stderr_still_gives_a_message() {
        assert_eq!(error_message("  \n"), "yt-dlp exited with an error");
    }

    #[test]
    fn the_stderr_text_is_trimmed() {
        assert_eq!(error_message("ERROR: boom\n"), "ERROR: boom");
    }

    // ── faux yt-dlp : suivi de bout en bout ──────────────────────────────────

    use std::process::Stdio;

    /// Lance un script `sh` à la place de yt-dlp, l'enregistre et le suit jusqu'au bout.
    async fn run_fake(script: &str, cancel_after_ms: Option<u64>) -> Vec<DownloadEvent> {
        let registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));
        let mut child = tokio::process::Command::new("/bin/sh")
            .arg("-c")
            .arg(script)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .expect("sh indisponible");
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        registry.lock().await.insert("dl".to_string(), child);

        let events = Arc::new(std::sync::Mutex::new(Vec::new()));
        let sink = events.clone();
        let task = tokio::spawn(drive_download(
            stdout,
            stderr,
            "dl".to_string(),
            false,
            "/out".to_string(),
            registry.clone(),
            move |e| sink.lock().unwrap().push(e),
        ));
        if let Some(ms) = cancel_after_ms {
            tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
            if let Some(mut c) = registry.lock().await.remove("dl") {
                let _ = c.kill().await;
            }
        }
        tokio::time::timeout(std::time::Duration::from_secs(20), task)
            .await
            .expect("le suivi ne doit jamais rester bloqué")
            .unwrap();
        let out = events.lock().unwrap().clone();
        out
    }

    #[tokio::test]
    async fn a_successful_run_reports_progress_then_completion() {
        let events = run_fake(
            "echo '[download] Destination: /out/Clip.mp4'; \
             echo '[download]  50.0% of   10.00MiB at    1.00MiB/s ETA 00:05'; exit 0",
            None,
        )
        .await;

        assert!(matches!(&events[0], DownloadEvent::Progress(p) if p.filename == "Clip.mp4"));
        assert!(
            matches!(events.last(), Some(DownloadEvent::Complete(c)) if c.filepath == "/out/Clip.mp4")
        );
    }

    #[tokio::test]
    async fn a_non_zero_exit_reports_an_error_with_stderr() {
        let events = run_fake("echo 'ERROR: Video unavailable' >&2; exit 1", None).await;

        assert!(
            matches!(events.last(), Some(DownloadEvent::Error(e)) if e.message.contains("Video unavailable"))
        );
        assert!(!events
            .iter()
            .any(|e| matches!(e, DownloadEvent::Complete(_))));
    }

    #[tokio::test]
    async fn a_failure_without_stderr_still_has_a_message() {
        let events = run_fake("exit 3", None).await;

        assert!(matches!(events.last(), Some(DownloadEvent::Error(e)) if !e.message.is_empty()));
    }

    #[tokio::test]
    async fn a_huge_stderr_does_not_block_the_process() {
        // 300 Ko sur stderr : bien au-delà de la capacité d'un pipe (64 Ko).
        let events = run_fake(
            "i=0; while [ $i -lt 3000 ]; do echo 'WARNING: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' >&2; i=$((i+1)); done; exit 0",
            None,
        )
        .await;

        assert!(matches!(events.last(), Some(DownloadEvent::Complete(_))));
    }

    #[tokio::test]
    async fn invalid_utf8_on_stdout_does_not_stop_the_reading() {
        let events = run_fake(
            "printf '\\377\\376 garbage\\n'; echo '[download]  10.0% of   1.00MiB at    1.00MiB/s ETA 00:01'; exit 0",
            None,
        )
        .await;

        assert!(events
            .iter()
            .any(|e| matches!(e, DownloadEvent::Progress(_))));
        assert!(matches!(events.last(), Some(DownloadEvent::Complete(_))));
    }

    #[tokio::test]
    async fn a_cancelled_run_emits_neither_completion_nor_error() {
        let events = run_fake("exec /bin/sleep 30", Some(200)).await;

        assert!(!events
            .iter()
            .any(|e| matches!(e, DownloadEvent::Complete(_) | DownloadEvent::Error(_))));
    }

    #[test]
    fn partial_files_of_a_cancelled_download_are_removed() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("Clip.f137.mp4");
        let part = dir.path().join("Clip.f137.mp4.part");
        let ytdl = dir.path().join("Clip.f137.mp4.ytdl");
        std::fs::write(&part, b"x").unwrap();
        std::fs::write(&ytdl, b"x").unwrap();

        remove_partial_files(file.to_str().unwrap());

        assert!(!part.exists() && !ytdl.exists());
    }

    #[test]
    fn removing_partials_of_an_unknown_file_is_a_no_op() {
        remove_partial_files("");
        remove_partial_files("/nowhere/Clip.mp4");
    }
}
