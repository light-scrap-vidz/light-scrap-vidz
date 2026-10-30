use std::time::Duration;

use serde::Serialize;
use ts_rs::TS;

use crate::ytdlp::builder::{js_runtime_in, path_dirs, spawn_path};

/// Ce que yt-dlp attend de la machine et que l'app ne fournit pas.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, rename = "DependencyStatus")]
pub struct DependencyStatus {
    /// ffmpeg : fusion vidéo + audio (qualité « Best ») et extraction MP3.
    pub ffmpeg: bool,
    /// Moteur JavaScript (deno, node ou bun), que YouTube exigera bientôt.
    pub js_runtime: bool,
}

async fn ffmpeg_works() -> bool {
    let run = tokio::process::Command::new("ffmpeg")
        .arg("-version")
        .env("PATH", spawn_path())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .status();
    matches!(
        tokio::time::timeout(Duration::from_secs(5), run).await,
        Ok(Ok(status)) if status.success()
    )
}

#[tauri::command]
pub async fn check_dependencies() -> DependencyStatus {
    let js_runtime = tokio::task::spawn_blocking(|| js_runtime_in(&path_dirs()).is_some())
        .await
        .unwrap_or(false);
    DependencyStatus {
        ffmpeg: ffmpeg_works().await,
        js_runtime,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn the_report_serialises_with_both_flags() {
        let status = check_dependencies().await;

        let json = serde_json::to_value(&status).unwrap();
        assert!(json["ffmpeg"].is_boolean());
        assert!(json["js_runtime"].is_boolean());
    }

    #[tokio::test]
    async fn a_missing_program_is_not_a_working_ffmpeg() {
        // Same probe with a PATH that holds nothing: the spawn fails, it must not panic.
        let run = tokio::process::Command::new("ffmpeg")
            .arg("-version")
            .env("PATH", "/nonexistent")
            .status()
            .await;

        assert!(run.is_err());
    }
}
