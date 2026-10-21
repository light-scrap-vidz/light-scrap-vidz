use std::path::Path;

/// Vérifie que le fichier à ouvrir existe. Séparé de la commande pour que le contrôle
/// soit testable sans lancer de processus externe.
pub fn check_openable(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }
    // Folders are fine (playlist downloads); files must be media: `open`/`xdg-open` would
    // otherwise launch scripts or applications handed over by the webview.
    if p.is_file() {
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .map(str::to_lowercase)
            .unwrap_or_default();
        if !MEDIA_EXTENSIONS.contains(&ext.as_str()) {
            return Err(format!("Refusing to open a non-media file: {path}"));
        }
    }
    Ok(())
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "webm", "mov", "avi", "m4v", "flv", "mp3", "m4a", "opus", "ogg", "wav", "aac",
    "flac",
];

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    check_openable(&path)?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_existing_file_passes_the_check() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("clip.mp4");
        std::fs::write(&file, b"x").unwrap();

        assert!(check_openable(file.to_str().unwrap()).is_ok());
    }

    #[test]
    fn a_non_media_file_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("run.sh");
        std::fs::write(&file, b"#!/bin/sh").unwrap();

        assert!(check_openable(file.to_str().unwrap()).is_err());
    }

    #[test]
    fn a_missing_file_is_reported_with_its_path() {
        let err = check_openable("/nowhere/clip.mp4").unwrap_err();

        assert_eq!(err, "File not found: /nowhere/clip.mp4");
    }

    #[test]
    fn an_empty_path_is_rejected() {
        assert!(check_openable("").is_err());
    }

    #[test]
    fn a_directory_also_passes_the_existence_check() {
        let dir = tempfile::tempdir().unwrap();

        assert!(check_openable(dir.path().to_str().unwrap()).is_ok());
    }

    #[tokio::test]
    async fn the_command_refuses_a_missing_file() {
        assert!(open_file("/nowhere/clip.mp4".to_string()).await.is_err());
    }
}
