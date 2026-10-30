use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Child;
use tokio::sync::Mutex;
use ts_rs::TS;

use crate::ytdlp::parser::{
    format_bytes, format_eta, format_speed, parse_download_line, parse_file_line,
    parse_postprocess_line, stage_for, stream_count,
};

/// Un téléchargement en cours : son processus, l'URL (pour refuser un doublon) et le
/// dossier de ses fichiers intermédiaires.
pub struct ActiveDownload {
    pub child: Child,
    pub url: String,
    pub temp_dir: PathBuf,
}

pub type DownloadRegistry = Arc<Mutex<HashMap<String, ActiveDownload>>>;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, rename = "DownloadProgress")]
pub struct ProgressPayload {
    pub download_id: String,
    /// Avancement global : tous les flux d'un élément, puis tous les éléments d'une playlist.
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub filename: String,
    pub current_item: Option<u32>,
    pub total_items: Option<u32>,
    /// Quantité déjà téléchargée, lisible (`12.00MiB`) : seule indication quand la taille
    /// totale est inconnue.
    pub downloaded: String,
    /// La taille totale n'est pas connue : `percent` n'a pas de sens.
    pub indeterminate: bool,
    /// Étape après le téléchargement : `merging`, `converting`, `fixing` ou `processing`.
    pub stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, rename = "DownloadComplete")]
pub struct CompletePayload {
    pub download_id: String,
    pub filepath: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, rename = "DownloadError")]
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
    final_file: String,
    filename: String,
    item: Option<u32>,
    total_items: Option<u32>,
    /// Rang du flux en cours dans l'élément (vidéo puis audio : 0 puis 1).
    stream: u32,
    /// Plus haut avancement atteint : la barre ne recule jamais.
    last_percent: f32,
}

impl ProgressTracker {
    pub fn new(download_id: String) -> Self {
        Self {
            download_id,
            final_file: String::new(),
            filename: String::new(),
            item: None,
            total_items: None,
            stream: 0,
            last_percent: 0.0,
        }
    }

    fn payload(&self, percent: f32) -> ProgressPayload {
        ProgressPayload {
            download_id: self.download_id.clone(),
            percent,
            speed: String::new(),
            eta: String::new(),
            filename: basename(&self.filename),
            current_item: self.item,
            total_items: self.total_items,
            downloaded: String::new(),
            indeterminate: false,
            stage: None,
        }
    }

    /// Consomme une ligne ; renvoie un payload pour une progression ou une nouvelle étape de
    /// post-traitement. Les lignes qui donnent le chemin final ne font que mettre à jour l'état.
    pub fn consume(&mut self, line: &str) -> Option<ProgressPayload> {
        if let Some(path) = parse_file_line(line) {
            self.final_file = path;
            return None;
        }
        if let Some(pp) = parse_postprocess_line(line) {
            let stage = stage_for(&pp.processor).filter(|_| pp.started)?;
            // Everything is downloaded by now: only the conversion is left.
            let mut payload = self.payload(self.last_percent.max(self.item_end_percent()));
            payload.stage = Some(stage.to_string());
            return Some(payload);
        }
        let d = parse_download_line(line)?;

        if d.item != self.item {
            self.stream = 0;
            self.filename.clear();
        }
        if !self.filename.is_empty() && d.filename != self.filename {
            self.stream += 1;
        }
        self.item = d.item;
        self.total_items = d.total_items;
        self.filename = d.filename.clone();

        let streams = stream_count(&d.filename) as f32;
        let fraction = match (d.finished, d.total) {
            (true, _) => Some(1.0),
            (false, Some(total)) => Some((d.downloaded / total).clamp(0.0, 1.0) as f32),
            (false, None) => None,
        };
        let within_item = (self.stream as f32 + fraction.unwrap_or(0.0)) / streams;
        let within_item = within_item.clamp(0.0, 1.0);
        let overall = match (self.item, self.total_items) {
            (Some(i), Some(n)) if n > 0 => ((i.saturating_sub(1)) as f32 + within_item) / n as f32,
            _ => within_item,
        };
        let percent = (overall * 100.0).max(self.last_percent);
        self.last_percent = percent;

        let mut payload = self.payload(percent);
        payload.speed = d.speed.map(format_speed).unwrap_or_default();
        payload.eta = d.eta.map(format_eta).unwrap_or_default();
        payload.downloaded = format_bytes(d.downloaded);
        payload.indeterminate = fraction.is_none();
        Some(payload)
    }

    /// Avancement global à la fin de l'élément en cours.
    fn item_end_percent(&self) -> f32 {
        match (self.item, self.total_items) {
            (Some(i), Some(n)) if n > 0 => i as f32 / n as f32 * 100.0,
            _ => 100.0,
        }
    }

    /// Chemin du dernier fichier produit, tel que yt-dlp l'a annoncé une fois déplacé.
    pub fn final_file(&self) -> &str {
        &self.final_file
    }
}

/// Dernier segment d'un chemin, chaîne vide si le chemin l'est.
pub fn basename(path: &str) -> String {
    path.split('/').next_back().unwrap_or("").to_string()
}

/// Ce que l'événement « terminé » désigne : le fichier produit, ou le dossier de sortie
/// pour une playlist (plusieurs fichiers) ou quand yt-dlp n'a annoncé aucun fichier.
pub fn completed_path(is_playlist: bool, final_file: &str, output_dir: &str) -> String {
    if is_playlist || final_file.is_empty() {
        output_dir.to_string()
    } else {
        final_file.to_string()
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

/// Supprime le dossier des fichiers intermédiaires d'un téléchargement.
pub fn remove_temp_dir(dir: &std::path::Path) {
    let _ = std::fs::remove_dir_all(dir);
}

/// Lit un flux ligne à ligne (octets invalides remplacés) et transmet chaque ligne.
async fn pump<R: tokio::io::AsyncRead + Unpin>(
    stream: R,
    tx: tokio::sync::mpsc::UnboundedSender<(bool, String)>,
    is_stderr: bool,
) {
    let mut reader = BufReader::new(stream);
    let mut raw = Vec::new();
    loop {
        raw.clear();
        match reader.read_until(b'\n', &mut raw).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&raw).into_owned();
                if tx.send((is_stderr, line)).is_err() {
                    break;
                }
            }
        }
    }
}

/// Suit un processus yt-dlp jusqu'à sa fin. Séparé de la commande Tauri pour pouvoir être
/// testé avec un faux yt-dlp : lecture concurrente de stdout et stderr (sinon un pipe plein
/// bloque le processus), code retour, annulation.
///
/// yt-dlp écrit la progression et le chemin final sur stdout, mais les étapes de
/// post-traitement (fusion, conversion) sur stderr : les deux flux passent par le suivi.
pub async fn drive_download(
    stdout: tokio::process::ChildStdout,
    stderr: tokio::process::ChildStderr,
    id: String,
    is_playlist: bool,
    output_dir: String,
    registry: DownloadRegistry,
    emit: impl Fn(DownloadEvent) + Send + 'static,
) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    tokio::spawn(pump(stdout, tx.clone(), false));
    tokio::spawn(pump(stderr, tx, true));

    let mut tracker = ProgressTracker::new(id.clone());
    let mut stderr_text = String::new();
    while let Some((is_stderr, line)) = rx.recv().await {
        if let Some(payload) = tracker.consume(line.trim_end()) {
            emit(DownloadEvent::Progress(payload));
        }
        if is_stderr && (line.starts_with("ERROR:") || stderr_text.len() < STDERR_KEEP) {
            stderr_text.push_str(&line);
        }
    }
    let final_file = tracker.final_file().to_string();

    // A cancelled download has already been removed from the registry (and its temp
    // folder deleted by the cancellation).
    let Some(mut active) = registry.lock().await.remove(&id) else {
        return;
    };
    let succeeded = matches!(active.child.wait().await, Ok(status) if status.success());
    remove_temp_dir(&active.temp_dir);

    if succeeded {
        emit(DownloadEvent::Complete(CompletePayload {
            download_id: id,
            filepath: completed_path(is_playlist, &final_file, &output_dir),
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

    const FILE: &str = "LSV_FILE:/home/me/Videos/Clip [x].mp4";

    fn dl(item: &str, total: &str, status: &str, done: u64, size: &str, file: &str) -> String {
        format!("LSV_DL {item} {total} {status} {done} {size} NA 1289748.0 9 /tmp/{file}")
    }

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
    fn a_download_with_no_announced_file_falls_back_to_the_directory() {
        assert_eq!(completed_path(false, "", "/out"), "/out");
    }

    // ── suivi de progression ─────────────────────────────────────────────────

    #[test]
    fn a_progress_line_produces_a_payload() {
        let mut t = tracker();

        let p = t
            .consume(&dl(
                "NA",
                "NA",
                "downloading",
                5_000_000,
                "10000000",
                "a.mp4",
            ))
            .unwrap();

        assert_eq!(p.download_id, "dl-1");
        assert!((p.percent - 50.0).abs() < 0.01);
        assert_eq!(p.speed, "1.23MiB/s");
        assert_eq!(p.eta, "00:09");
        assert_eq!(p.filename, "a.mp4");
        assert_eq!(p.downloaded, "4.77MiB");
        assert!(!p.indeterminate);
        assert_eq!(p.stage, None);
    }

    #[test]
    fn the_final_line_of_a_download_reaches_one_hundred_percent() {
        let mut t = tracker();
        t.consume(&dl("NA", "NA", "downloading", 5, "10", "a.mp4"));

        let p = t
            .consume(&dl("NA", "NA", "finished", 10, "10", "a.mp4"))
            .unwrap();

        assert!((p.percent - 100.0).abs() < 0.01);
    }

    #[test]
    fn a_download_of_unknown_size_is_flagged_and_shows_the_amount() {
        let mut t = tracker();

        let p = t
            .consume("LSV_DL NA NA downloading 12582912 NA NA 1258291.2 NA /tmp/live.mp4")
            .unwrap();

        assert!(p.indeterminate);
        assert_eq!(p.percent, 0.0);
        assert_eq!(p.downloaded, "12.00MiB");
        assert_eq!(p.eta, "");
    }

    #[test]
    fn video_then_audio_fills_the_bar_once() {
        let mut t = tracker();

        let video_half = t
            .consume(&dl(
                "NA",
                "NA",
                "downloading",
                50,
                "100",
                "Clip [x].f137.mp4",
            ))
            .unwrap();
        let video_done = t
            .consume(&dl("NA", "NA", "finished", 100, "100", "Clip [x].f137.mp4"))
            .unwrap();
        let audio_start = t
            .consume(&dl(
                "NA",
                "NA",
                "downloading",
                1,
                "100",
                "Clip [x].f140.m4a",
            ))
            .unwrap();
        let audio_done = t
            .consume(&dl("NA", "NA", "finished", 100, "100", "Clip [x].f140.m4a"))
            .unwrap();

        assert!((video_half.percent - 25.0).abs() < 0.01);
        assert!((video_done.percent - 50.0).abs() < 0.01);
        assert!(audio_start.percent >= 50.0);
        assert!((audio_done.percent - 100.0).abs() < 0.01);
    }

    #[test]
    fn a_playlist_shares_the_bar_between_its_items() {
        let mut t = tracker();

        let first = t
            .consume(&dl("1", "4", "downloading", 50, "100", "1.mp4"))
            .unwrap();
        let second = t
            .consume(&dl("2", "4", "downloading", 50, "100", "2.mp4"))
            .unwrap();
        let last = t
            .consume(&dl("4", "4", "finished", 100, "100", "4.mp4"))
            .unwrap();

        assert!((first.percent - 12.5).abs() < 0.01);
        assert!((second.percent - 37.5).abs() < 0.01);
        assert!((last.percent - 100.0).abs() < 0.01);
        assert_eq!(
            (second.current_item, second.total_items),
            (Some(2), Some(4))
        );
    }

    #[test]
    fn the_counters_stay_unset_outside_a_playlist() {
        let mut t = tracker();

        let p = t
            .consume(&dl("NA", "NA", "downloading", 1, "10", "a.mp4"))
            .unwrap();

        assert_eq!((p.current_item, p.total_items), (None, None));
    }

    #[test]
    fn the_bar_never_moves_backwards() {
        let mut t = tracker();
        t.consume(&dl("NA", "NA", "downloading", 80, "100", "a.mp4"));

        // The estimate of an HLS download grows as fragments arrive.
        let p = t
            .consume(&dl("NA", "NA", "downloading", 80, "400", "a.mp4"))
            .unwrap();

        assert!((p.percent - 80.0).abs() < 0.01);
    }

    #[test]
    fn a_conversion_step_is_announced_with_a_full_bar() {
        let mut t = tracker();
        t.consume(&dl("NA", "NA", "finished", 10, "10", "a.mp4"));

        let p = t.consume("LSV_PP Merger started").unwrap();

        assert_eq!(p.stage.as_deref(), Some("merging"));
        assert!((p.percent - 100.0).abs() < 0.01);
    }

    #[test]
    fn a_conversion_in_the_middle_of_a_playlist_keeps_the_items_share() {
        let mut t = tracker();
        t.consume(&dl("2", "4", "finished", 10, "10", "2.mp4"));

        let p = t.consume("LSV_PP ExtractAudio started").unwrap();

        assert_eq!(p.stage.as_deref(), Some("converting"));
        assert!((p.percent - 50.0).abs() < 0.01);
    }

    #[test]
    fn finished_and_unannounced_steps_produce_nothing() {
        let mut t = tracker();

        assert!(t.consume("LSV_PP Merger finished").is_none());
        assert!(t.consume("LSV_PP MoveFiles started").is_none());
    }

    #[test]
    fn the_final_file_comes_from_the_print_line() {
        let mut t = tracker();

        assert!(t.consume(FILE).is_none());

        assert_eq!(t.final_file(), "/home/me/Videos/Clip [x].mp4");
    }

    #[test]
    fn the_last_announced_file_wins() {
        let mut t = tracker();
        t.consume("LSV_FILE:/out/1.mp4");
        t.consume("LSV_FILE:/out/2.mp4");

        assert_eq!(t.final_file(), "/out/2.mp4");
    }

    #[test]
    fn unrelated_lines_are_ignored() {
        let mut t = tracker();

        for line in [
            "[youtube] Extracting URL: https://y.tld/watch?v=x",
            "[info] Downloading 1 format(s): 137+140",
            "[download] 100% of   18.23MiB in 00:00:05 at 2.00MiB/s",
            "",
            "WARNING: unable to obtain file audio codec",
        ] {
            assert!(t.consume(line).is_none(), "{line}");
        }
        assert_eq!(t.final_file(), "");
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
        let (events, _) = run_fake_in(script, cancel_after_ms, false, None).await;
        events
    }

    async fn run_fake_in(
        script: &str,
        cancel_after_ms: Option<u64>,
        is_playlist: bool,
        temp_dir: Option<PathBuf>,
    ) -> (Vec<DownloadEvent>, DownloadRegistry) {
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
        registry.lock().await.insert(
            "dl".to_string(),
            ActiveDownload {
                child,
                url: "https://y.tld/x".to_string(),
                temp_dir: temp_dir.unwrap_or_else(|| PathBuf::from("/nonexistent/lsv-tmp")),
            },
        );

        let events = Arc::new(std::sync::Mutex::new(Vec::new()));
        let sink = events.clone();
        let task = tokio::spawn(drive_download(
            stdout,
            stderr,
            "dl".to_string(),
            is_playlist,
            "/out".to_string(),
            registry.clone(),
            move |e| sink.lock().unwrap().push(e),
        ));
        if let Some(ms) = cancel_after_ms {
            tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
            if let Some(mut c) = registry.lock().await.remove("dl") {
                let _ = c.child.kill().await;
            }
        }
        tokio::time::timeout(std::time::Duration::from_secs(20), task)
            .await
            .expect("le suivi ne doit jamais rester bloqué")
            .unwrap();
        let out = events.lock().unwrap().clone();
        (out, registry)
    }

    #[tokio::test]
    async fn a_successful_run_reports_progress_then_the_final_file() {
        let events = run_fake(
            "echo 'LSV_DL NA NA downloading 5 10 NA 1000.0 5 /tmp/Clip.mp4'; \
             echo 'LSV_DL NA NA finished 10 10 NA 1000.0 NA /tmp/Clip.mp4'; \
             echo 'LSV_FILE:/out/Clip.mp4'; exit 0",
            None,
        )
        .await;

        assert!(matches!(&events[0], DownloadEvent::Progress(p) if p.filename == "Clip.mp4"));
        assert!(
            matches!(events.last(), Some(DownloadEvent::Complete(c)) if c.filepath == "/out/Clip.mp4")
        );
    }

    #[tokio::test]
    async fn conversion_steps_announced_on_stderr_reach_the_tracker() {
        // yt-dlp prints the post-processing lines on stderr, not on stdout.
        let events = run_fake(
            "echo 'LSV_DL NA NA finished 10 10 NA 1000.0 NA /tmp/Clip.mp4'; \
             echo 'LSV_PP Merger started' >&2; echo 'LSV_FILE:/out/Clip.mp4'; exit 0",
            None,
        )
        .await;

        assert!(events.iter().any(
            |e| matches!(e, DownloadEvent::Progress(p) if p.stage.as_deref() == Some("merging"))
        ));
        assert!(matches!(events.last(), Some(DownloadEvent::Complete(_))));
    }

    #[tokio::test]
    async fn an_already_downloaded_file_still_completes_on_its_exact_path() {
        // Nothing to download: yt-dlp only prints the final path.
        let events = run_fake("echo 'LSV_FILE:/out/Existing [id].mp4'; exit 0", None).await;

        assert_eq!(events.len(), 1);
        assert!(
            matches!(&events[0], DownloadEvent::Complete(c) if c.filepath == "/out/Existing [id].mp4")
        );
    }

    #[tokio::test]
    async fn a_playlist_completes_on_its_output_folder() {
        let (events, _) = run_fake_in("echo 'LSV_FILE:/out/1.mp4'; exit 0", None, true, None).await;

        assert!(matches!(events.last(), Some(DownloadEvent::Complete(c)) if c.filepath == "/out"));
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
            "printf '\\377\\376 garbage\\n'; echo 'LSV_DL NA NA downloading 1 10 NA 100.0 9 /tmp/a.mp4'; exit 0",
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

    #[tokio::test]
    async fn the_temp_folder_is_removed_when_the_run_ends() {
        let tmp = tempfile::tempdir().unwrap();
        let work = tmp.path().join(".lsv-dl");
        std::fs::create_dir_all(&work).unwrap();
        std::fs::write(work.join("a.part"), b"x").unwrap();

        let (_, registry) = run_fake_in("exit 1", None, false, Some(work.clone())).await;

        assert!(!work.exists());
        assert!(registry.lock().await.is_empty());
    }

    #[test]
    fn removing_a_missing_temp_folder_is_a_no_op() {
        remove_temp_dir(std::path::Path::new("/nowhere/lsv-tmp"));
    }

    /// Contre le vrai yt-dlp et le réseau : vérifie que les modèles demandés (`--progress-template`,
    /// `--print`) produisent bien ce que le parseur lit. À lancer à la main :
    /// `YTDLP_PATH=/chemin/yt-dlp cargo test real_yt_dlp -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore = "needs network, yt-dlp and ffmpeg"]
    async fn real_yt_dlp_download_reports_progress_and_the_final_file() {
        use crate::ytdlp::builder::{DownloadCommand, Quality};
        let binary = std::env::var("YTDLP_PATH").expect("YTDLP_PATH");
        let out = tempfile::tempdir().unwrap();
        let temp = out.path().join(".tmp");
        let cmd = DownloadCommand {
            binary: PathBuf::from(binary),
            url: "https://www.youtube.com/watch?v=jNQXAC9IVRw".to_string(),
            output_dir: out.path().to_path_buf(),
            temp_dir: temp.clone(),
            quality: Quality::Best,
            cookies_browser: None,
            audio_only: false,
        }
        .build();
        let mut command = tokio::process::Command::from(cmd);
        let mut child = command
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));
        registry.lock().await.insert(
            "real".to_string(),
            ActiveDownload {
                child,
                url: String::new(),
                temp_dir: temp.clone(),
            },
        );
        let events = Arc::new(std::sync::Mutex::new(Vec::new()));
        let sink = events.clone();
        drive_download(
            stdout,
            stderr,
            "real".to_string(),
            false,
            out.path().to_string_lossy().into_owned(),
            registry,
            move |e| sink.lock().unwrap().push(e),
        )
        .await;

        let events = events.lock().unwrap().clone();
        for e in &events {
            println!("{e:?}");
        }
        let Some(DownloadEvent::Complete(done)) = events.last() else {
            panic!("expected completion, got {:?}", events.last());
        };
        assert!(done.filepath.ends_with(".mp4"), "{}", done.filepath);
        assert!(std::path::Path::new(&done.filepath).is_file());
        let best = events
            .iter()
            .filter_map(|e| match e {
                DownloadEvent::Progress(p) => Some(p.percent),
                _ => None,
            })
            .fold(0.0_f32, f32::max);
        assert!(
            (best - 100.0).abs() < 0.01,
            "the bar must reach 100%, got {best}"
        );
        assert!(events.iter().any(
            |e| matches!(e, DownloadEvent::Progress(p) if p.stage.as_deref() == Some("merging"))
        ));
        assert!(!temp.exists(), "the temp folder must be gone");
    }
}
