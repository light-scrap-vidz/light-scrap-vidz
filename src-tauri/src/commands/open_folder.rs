use std::path::{Path, PathBuf};

/// Dossier à révéler : le chemin lui-même, ou son parent si c'est un fichier.
/// Séparé de la commande pour que la règle soit testable sans lancer de processus.
pub fn folder_to_reveal(path: &str) -> PathBuf {
    let p = Path::new(path);
    if p.is_file() {
        p.parent().unwrap_or(p).to_path_buf()
    } else {
        p.to_path_buf()
    }
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    let dir = folder_to_reveal(&path);

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_file_reveals_its_parent_directory() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("clip.mp4");
        std::fs::write(&file, b"x").unwrap();

        assert_eq!(folder_to_reveal(file.to_str().unwrap()), dir.path());
    }

    #[test]
    fn a_directory_is_used_as_is() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(
            folder_to_reveal(dir.path().to_str().unwrap()),
            dir.path().to_path_buf()
        );
    }

    #[test]
    fn a_path_that_does_not_exist_is_used_as_is() {
        // Pas de `is_file()` possible : on laisse le système trancher.
        assert_eq!(
            folder_to_reveal("/nowhere/deep"),
            PathBuf::from("/nowhere/deep")
        );
    }

    #[test]
    fn a_root_level_file_falls_back_to_itself() {
        // Un fichier sans parent utilisable ne doit pas faire paniquer.
        assert_eq!(folder_to_reveal("/"), PathBuf::from("/"));
    }
}
