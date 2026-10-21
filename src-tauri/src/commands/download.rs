use std::path::PathBuf;
use std::process::Stdio;
use std::str::FromStr;

use tauri::Emitter;

pub use super::download_runner::DownloadRegistry;
use super::download_runner::{
    drive_download, DownloadEvent, EVENT_COMPLETE, EVENT_ERROR, EVENT_PROGRESS,
};
use crate::ytdlp::{
    builder::{DownloadCommand, PlaylistDownloadCommand, Quality},
    finder::YtDlpBinary,
};

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
    if state.lock().await.contains_key(&download_id) {
        return Err("A download with this id is already running".to_string());
    }
    let binary = YtDlpBinary::find_with_app(&app)?;
    let q = Quality::from_str(&quality).unwrap_or(Quality::Best);
    let binary_path = binary.path().to_path_buf();
    let output_dir_clone = output_dir.clone();

    let cmd = match playlist_end {
        None => DownloadCommand {
            binary: binary_path,
            url,
            output_dir: PathBuf::from(&output_dir),
            quality: q,
            cookies_browser,
            audio_only,
        }
        .build(),
        Some(n) => PlaylistDownloadCommand {
            binary: binary_path,
            url,
            output_dir: PathBuf::from(&output_dir),
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
    let mut process = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}"))?;

    let stdout = process.stdout.take().ok_or("yt-dlp stdout unavailable")?;
    let stderr = process.stderr.take().ok_or("yt-dlp stderr unavailable")?;

    {
        let mut registry = state.lock().await;
        registry.insert(download_id.clone(), process);
    }

    let app_handle = app.clone();
    let registry = state.inner().clone();
    tokio::spawn(drive_download(
        stdout,
        stderr,
        download_id,
        playlist_end.is_some(),
        output_dir_clone,
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

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, DownloadRegistry>,
    download_id: String,
) -> Result<(), String> {
    let mut registry = state.lock().await;
    if let Some(mut child) = registry.remove(&download_id) {
        #[cfg(unix)]
        if let Some(pid) = child.id() {
            super::fetch_slots::kill_group(pid);
        }
        let _ = child.kill().await;
    }
    Ok(())
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
        tokio::process::Command::new("/bin/sleep")
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
