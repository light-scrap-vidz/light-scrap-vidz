use std::path::{Path, PathBuf};

use super::open_file::is_bundle;

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

/// Le chemin existe et n'est pas un paquet d'application que `open` lancerait.
pub fn check_revealable(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }
    if p.is_dir() && is_bundle(p) {
        return Err(format!("Refusing to open an application bundle: {path}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    check_revealable(&path)?;
    tokio::task::spawn_blocking(move || reveal(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// Sélectionne le fichier dans le gestionnaire de fichiers ; à défaut (aucun gestionnaire
/// compatible D-Bus : LXDE, gestionnaire de fenêtres seul…), ouvre son dossier.
fn reveal(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.is_file() && tauri_plugin_opener::reveal_item_in_dir(p).is_ok() {
        return Ok(());
    }
    tauri_plugin_opener::open_path(folder_to_reveal(path), None::<&str>).map_err(|e| e.to_string())
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
    fn a_missing_path_is_reported_before_anything_is_launched() {
        let err = check_revealable("/nowhere/clip.mp4").unwrap_err();

        assert_eq!(err, "File not found: /nowhere/clip.mp4");
    }

    #[test]
    fn an_application_bundle_cannot_be_revealed_as_a_folder() {
        let dir = tempfile::tempdir().unwrap();
        let bundle = dir.path().join("Evil.app");
        std::fs::create_dir(&bundle).unwrap();

        assert!(check_revealable(bundle.to_str().unwrap()).is_err());
    }

    #[test]
    fn files_and_ordinary_folders_can_be_revealed() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("clip.mp4");
        std::fs::write(&file, b"x").unwrap();

        assert!(check_revealable(file.to_str().unwrap()).is_ok());
        assert!(check_revealable(dir.path().to_str().unwrap()).is_ok());
    }

    #[tokio::test]
    async fn the_command_refuses_a_missing_path() {
        assert!(open_folder("/nowhere/clip.mp4".to_string()).await.is_err());
    }

    #[test]
    fn a_root_level_file_falls_back_to_itself() {
        // Un fichier sans parent utilisable ne doit pas faire paniquer.
        assert_eq!(folder_to_reveal("/"), PathBuf::from("/"));
    }
}
