use tauri::Manager;

/// Binaire yt-dlp à télécharger pour la plateforme courante.
pub fn ytdlp_url() -> &'static str {
    if cfg!(target_os = "macos") {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux"
    }
}

/// Prépare le dossier de destination et renvoie le chemin du binaire. Séparé de la
/// commande pour être testable sans AppHandle.
pub fn prepare_destination(data_dir: &std::path::Path) -> Result<std::path::PathBuf, String> {
    std::fs::create_dir_all(data_dir).map_err(|e| format!("Cannot create data dir: {e}"))?;
    Ok(data_dir.join("yt-dlp"))
}

pub fn interpret_download(success: bool, stderr: &[u8]) -> Result<(), String> {
    if success {
        return Ok(());
    }
    Err(format!(
        "Download failed: {}",
        String::from_utf8_lossy(stderr).trim()
    ))
}

/// Rend le binaire exécutable (0o755). No-op hors Unix.
pub fn make_executable(path: &std::path::Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Cannot set permissions: {e}"))?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

pub const SUCCESS_MESSAGE: &str = "yt-dlp updated successfully.";

/// Arguments de téléchargement du binaire yt-dlp.
pub fn curl_args<'a>(dest: &'a str, url: &'a str) -> Vec<&'a str> {
    vec!["-L", "-f", "--connect-timeout", "30", "-o", dest, url]
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot find app data dir: {e}"))?;

    let dest = prepare_destination(&data_dir)?;
    let dest_str = dest.to_string_lossy().into_owned();

    let out = tokio::process::Command::new("curl")
        .args(curl_args(&dest_str, ytdlp_url()))
        .output()
        .await
        .map_err(|e| format!("curl not available: {e}"))?;

    interpret_download(out.status.success(), &out.stderr)?;
    make_executable(&dest)?;

    Ok(SUCCESS_MESSAGE.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_url_targets_the_current_platform() {
        let url = ytdlp_url();

        assert!(url.starts_with("https://github.com/yt-dlp/yt-dlp/releases/latest/download/"));
        if cfg!(target_os = "macos") {
            assert!(url.ends_with("yt-dlp_macos"));
        } else {
            assert!(url.ends_with("yt-dlp_linux"));
        }
    }

    #[test]
    fn the_destination_is_named_yt_dlp_inside_the_data_dir() {
        let dir = tempfile::tempdir().unwrap();

        let dest = prepare_destination(dir.path()).unwrap();

        assert_eq!(dest, dir.path().join("yt-dlp"));
    }

    #[test]
    fn a_missing_data_dir_is_created() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("a/b/c");

        prepare_destination(&nested).unwrap();

        assert!(nested.is_dir());
    }

    #[test]
    fn an_uncreatable_data_dir_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("not-a-dir");
        std::fs::write(&file, b"x").unwrap();

        let err = prepare_destination(&file.join("sub")).unwrap_err();

        assert!(err.starts_with("Cannot create data dir:"), "{err}");
    }

    #[test]
    fn a_successful_download_is_accepted() {
        assert!(interpret_download(true, b"").is_ok());
    }

    #[test]
    fn a_failed_download_quotes_the_trimmed_stderr() {
        let err = interpret_download(false, b"  curl: (22) 404\n").unwrap_err();

        assert_eq!(err, "Download failed: curl: (22) 404");
    }

    #[cfg(unix)]
    #[test]
    fn the_downloaded_binary_becomes_executable() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("yt-dlp");
        std::fs::write(&file, b"#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();

        make_executable(&file).unwrap();

        let mode = std::fs::metadata(&file).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o755);
    }

    #[cfg(unix)]
    #[test]
    fn a_missing_binary_cannot_be_made_executable() {
        let err = make_executable(std::path::Path::new("/nowhere/yt-dlp")).unwrap_err();

        assert!(err.starts_with("Cannot set permissions:"), "{err}");
    }

    #[test]
    fn the_download_is_guarded_and_targets_the_destination() {
        let args = curl_args("/data/yt-dlp", ytdlp_url());

        assert!(args.contains(&"-L"));
        assert!(args.contains(&"-f"));
        let i = args.iter().position(|a| *a == "--connect-timeout").unwrap();
        assert_eq!(args[i + 1], "30");
        let o = args.iter().position(|a| *a == "-o").unwrap();
        assert_eq!(args[o + 1], "/data/yt-dlp");
        assert_eq!(args.last(), Some(&ytdlp_url()));
    }

    #[test]
    fn the_success_message_is_user_facing() {
        assert_eq!(SUCCESS_MESSAGE, "yt-dlp updated successfully.");
    }
}
