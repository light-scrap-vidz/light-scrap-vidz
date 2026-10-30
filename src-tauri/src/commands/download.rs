use std::path::PathBuf;
use std::process::Stdio;
use std::str::FromStr;

use tauri::Emitter;

pub use super::download_runner::DownloadRegistry;
use super::download_runner::{
    drive_download, remove_temp_dir, ActiveDownload, DownloadEvent, EVENT_COMPLETE, EVENT_ERROR,
    EVENT_PROGRESS,
};
use crate::ytdlp::{
    builder::{DownloadCommand, PlaylistDownloadCommand, Quality},
    finder::YtDlpBinary,
    validate,
};

/// Dossier des fichiers intermédiaires d'un téléchargement : caché, à côté du résultat (donc
/// sur le même disque, le déplacement final ne recopie rien) et propre à ce téléchargement.
pub fn temp_dir_for(output_dir: &std::path::Path, download_id: &str) -> PathBuf {
    let safe: String = download_id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    output_dir.join(format!(".light-scrap-vidz-{safe}"))
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
    validate::url(&url)?;
    validate::cookies_browser(&cookies_browser)?;
    let output_path = validate::output_dir(&output_dir)?;
    let binary = YtDlpBinary::find_with_app(&app)?;
    let q = Quality::from_str(&quality).unwrap_or(Quality::Best);
    let binary_path = binary.path().to_path_buf();
    let temp_dir = temp_dir_for(&output_path, &download_id);

    let cmd = match playlist_end {
        None => DownloadCommand {
            binary: binary_path,
            url: url.clone(),
            output_dir: output_path,
            temp_dir: temp_dir.clone(),
            quality: q,
            cookies_browser,
            audio_only,
        }
        .build(),
        Some(n) => PlaylistDownloadCommand {
            binary: binary_path,
            url: url.clone(),
            output_dir: output_path,
            temp_dir: temp_dir.clone(),
            quality: q,
            playlist_end: if n == 0 { None } else { Some(n) },
            cookies_browser,
            audio_only,
        }
        .build(),
    };
    let mut command = tokio::process::Command::from(cmd);
    // Own process group, so cancelling also stops the ffmpeg that yt-dlp launches.
    #[cfg(unix)]
    command.process_group(0);

    // One lock from the checks to the insertion: two starts cannot both pass.
    let mut registry = state.lock().await;
    if registry.contains_key(&download_id) {
        return Err("A download with this id is already running".to_string());
    }
    if registry.values().any(|d| d.url == url) {
        return Err("This URL is already being downloaded".to_string());
    }
    let mut process = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stdout = process.stdout.take().ok_or("yt-dlp stdout unavailable")?;
    let stderr = process.stderr.take().ok_or("yt-dlp stderr unavailable")?;
    registry.insert(
        download_id.clone(),
        ActiveDownload {
            child: process,
            url,
            temp_dir,
        },
    );
    drop(registry);

    let app_handle = app.clone();
    let registry = state.inner().clone();
    tokio::spawn(drive_download(
        stdout,
        stderr,
        download_id,
        playlist_end.is_some(),
        output_dir,
        registry,
        move |event| {
            let _ = match event {
                DownloadEvent::Progress(p) => app_handle.emit(EVENT_PROGRESS, p),
                DownloadEvent::Complete(c) => app_handle.emit(EVENT_COMPLETE, c),
                DownloadEvent::Error(e) => app_handle.emit(EVENT_ERROR, e),
            };
        },
    ));

    Ok(())
}

/// Arrête un téléchargement : tue le groupe de processus (yt-dlp et son ffmpeg), puis
/// supprime ses fichiers intermédiaires.
async fn stop(mut active: ActiveDownload) {
    #[cfg(unix)]
    if let Some(pid) = active.child.id() {
        super::fetch_slots::kill_group(pid);
    }
    let _ = active.child.kill().await;
    remove_temp_dir(&active.temp_dir);
}

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, DownloadRegistry>,
    download_id: String,
) -> Result<(), String> {
    // The lock is released before waiting on the process.
    let active = state.lock().await.remove(&download_id);
    if let Some(active) = active {
        stop(active).await;
    }
    Ok(())
}

/// Arrête tout ce qui tourne encore : appelé à la fermeture de l'app, qui ne détruit pas les
/// processus enfants d'elle-même.
pub async fn stop_all(registry: &DownloadRegistry) {
    let all: Vec<ActiveDownload> = registry.lock().await.drain().map(|(_, v)| v).collect();
    for active in all {
        stop(active).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::process::Child;
    use tokio::sync::Mutex;

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
        let mut cmd = tokio::process::Command::new("/bin/sleep");
        cmd.arg("30").kill_on_drop(true);
        #[cfg(unix)]
        cmd.process_group(0);
        cmd.spawn().expect("`sleep` indisponible")
    }

    fn active(child: Child, temp_dir: PathBuf) -> ActiveDownload {
        ActiveDownload {
            child,
            url: "https://y.tld/x".to_string(),
            temp_dir,
        }
    }

    #[test]
    fn the_temp_folder_is_hidden_inside_the_output_folder_and_named_after_the_download() {
        let dir = temp_dir_for(std::path::Path::new("/out"), "abc-123");

        assert_eq!(dir, PathBuf::from("/out/.light-scrap-vidz-abc-123"));
    }

    #[test]
    fn a_hostile_download_id_cannot_leave_the_output_folder() {
        let dir = temp_dir_for(std::path::Path::new("/out"), "../../etc");

        assert_eq!(dir.parent().unwrap(), std::path::Path::new("/out"));
        assert!(!dir.to_string_lossy().contains(".."));
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
        state
            .lock()
            .await
            .insert("dl-1".to_string(), active(child, PathBuf::from("/nowhere")));

        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();

        assert!(state.lock().await.is_empty());
        assert!(pid.is_some());
    }

    #[tokio::test]
    async fn cancelling_deletes_the_partial_files() {
        let app = registry_app();
        let tmp = tempfile::tempdir().unwrap();
        let work = tmp.path().join(".lsv");
        std::fs::create_dir_all(&work).unwrap();
        std::fs::write(work.join("Clip.f137.mp4.part"), b"x").unwrap();
        std::fs::write(work.join("Clip.f140.m4a"), b"x").unwrap();
        std::fs::write(work.join("Clip.temp.mp4"), b"x").unwrap();
        app.state::<DownloadRegistry>()
            .lock()
            .await
            .insert("dl-1".to_string(), active(spawn_sleeper(), work.clone()));

        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();

        assert!(!work.exists());
    }

    #[tokio::test]
    async fn cancelling_an_unknown_download_is_a_no_op() {
        let app = registry_app();
        let state = app.state::<DownloadRegistry>();
        state.lock().await.insert(
            "dl-1".to_string(),
            active(spawn_sleeper(), PathBuf::from("/nowhere")),
        );

        cancel_download(app.state::<DownloadRegistry>(), "autre".to_string())
            .await
            .unwrap();

        // L'entrée existante n'est pas touchée.
        assert_eq!(state.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn cancelling_twice_is_harmless() {
        let app = registry_app();
        app.state::<DownloadRegistry>().lock().await.insert(
            "dl-1".to_string(),
            active(spawn_sleeper(), PathBuf::from("/nowhere")),
        );

        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();
        cancel_download(app.state::<DownloadRegistry>(), "dl-1".to_string())
            .await
            .unwrap();

        assert!(app.state::<DownloadRegistry>().lock().await.is_empty());
    }

    #[cfg(unix)]
    fn alive(pid: u32) -> bool {
        // Signal 0 only checks that the process exists (a zombie counts as gone below).
        let exists = unsafe { libc::kill(pid as i32, 0) } == 0;
        exists
            && std::fs::read_to_string(format!("/proc/{pid}/stat"))
                .map(|s| !s.contains(") Z"))
                .unwrap_or(true)
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn closing_the_app_stops_every_running_download_and_cleans_up() {
        let tmp = tempfile::tempdir().unwrap();
        let registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));
        let mut pids = vec![];
        let mut dirs = vec![];
        for n in 0..2 {
            let work = tmp.path().join(format!(".lsv-{n}"));
            std::fs::create_dir_all(&work).unwrap();
            let child = spawn_sleeper();
            pids.push(child.id().unwrap());
            dirs.push(work.clone());
            registry
                .lock()
                .await
                .insert(format!("dl-{n}"), active(child, work));
        }
        assert!(pids.iter().all(|p| alive(*p)));

        stop_all(&registry).await;

        assert!(registry.lock().await.is_empty());
        assert!(dirs.iter().all(|d| !d.exists()));
        for _ in 0..50 {
            if pids.iter().all(|p| !alive(*p)) {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        panic!("a download process survived stop_all");
    }

    #[tokio::test]
    async fn stopping_with_nothing_running_is_a_no_op() {
        let registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));

        stop_all(&registry).await;

        assert!(registry.lock().await.is_empty());
    }
}
