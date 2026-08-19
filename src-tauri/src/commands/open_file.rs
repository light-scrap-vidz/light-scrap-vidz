use std::path::Path;

/// Vérifie que le fichier à ouvrir existe. Séparé de la commande pour que le contrôle
/// soit testable sans lancer de processus externe.
pub fn check_openable(path: &str) -> Result<(), String> {
    if !Path::new(path).exists() {
        return Err(format!("File not found: {path}"));
    }
    Ok(())
}

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
