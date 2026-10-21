use sha2::{Digest, Sha256};
use tauri::Manager;

use crate::ytdlp::finder::YtDlpBinary;

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
pub const UP_TO_DATE_MESSAGE: &str = "yt-dlp is already up to date.";

/// Arguments de téléchargement du binaire yt-dlp.
pub fn curl_args<'a>(dest: &'a str, url: &'a str) -> Vec<&'a str> {
    vec!["-L", "-f", "--connect-timeout", "30", "-o", dest, url]
}

/// Nom de l'asset yt-dlp pour la plateforme courante.
pub fn asset_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp_linux"
    }
}

pub const SUMS_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS";
pub const LATEST_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest";

/// Somme attendue pour `asset` dans un fichier `SHA2-256SUMS` (« <hash>  <nom> »).
pub fn expected_sha256(sums: &str, asset: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (name == asset).then(|| hash.to_lowercase())
    })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Tag de la dernière release, lu dans l'URL finale de la redirection `/releases/latest`.
pub fn tag_from_url(url: &str) -> Option<&str> {
    url.rsplit_once("/tag/").map(|(_, tag)| tag.trim())
}

async fn latest_tag() -> Option<String> {
    let out = tokio::process::Command::new("curl")
        .args([
            "-sIL",
            "--connect-timeout",
            "30",
            "-o",
            "/dev/null",
            "-w",
            "%{url_effective}",
            LATEST_URL,
        ])
        .output()
        .await
        .ok()?;
    let url = String::from_utf8_lossy(&out.stdout).into_owned();
    tag_from_url(&url).map(str::to_string)
}

async fn current_version(binary: &std::path::Path) -> Option<String> {
    let out = tokio::process::Command::new(binary)
        .arg("--version")
        .output()
        .await
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[tauri::command]
pub async fn update_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot find app data dir: {e}"))?;

    // Skip the ~40 MB download when the binary in use is already the latest release.
    if let (Ok(bin), Some(tag)) = (YtDlpBinary::find_with_app(&app), latest_tag().await) {
        if current_version(bin.path()).await.as_deref() == Some(tag.as_str()) {
            return Ok(UP_TO_DATE_MESSAGE.to_string());
        }
    }

    let dest = prepare_destination(&data_dir)?;
    // Download next to the destination, verify, then rename: an interrupted download never
    // replaces a working binary.
    let tmp = data_dir.join("yt-dlp.download");
    let tmp_str = tmp.to_string_lossy().into_owned();

    let sums = tokio::process::Command::new("curl")
        .args(["-fsSL", "--connect-timeout", "30", SUMS_URL])
        .output()
        .await
        .map_err(|e| format!("curl not available: {e}"))?;
    interpret_download(sums.status.success(), &sums.stderr)?;
    let expected = expected_sha256(&String::from_utf8_lossy(&sums.stdout), asset_name())
        .ok_or("No checksum published for this platform")?;

    let out = tokio::process::Command::new("curl")
        .args(curl_args(&tmp_str, ytdlp_url()))
        .output()
        .await
        .map_err(|e| format!("curl not available: {e}"))?;
    if let Err(e) = interpret_download(out.status.success(), &out.stderr) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }

    let bytes = std::fs::read(&tmp).map_err(|e| format!("Cannot read download: {e}"))?;
    if sha256_hex(&bytes) != expected {
        let _ = std::fs::remove_file(&tmp);
        return Err("Checksum mismatch: the downloaded yt-dlp was discarded".to_string());
    }

    make_executable(&tmp)?;
    std::fs::rename(&tmp, &dest).map_err(|e| format!("Cannot install yt-dlp: {e}"))?;

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
    fn the_expected_checksum_is_found_by_asset_name() {
        let sums = "AAA111  yt-dlp\nBBB222  yt-dlp_linux\nccc333 *yt-dlp_macos\n";

        assert_eq!(expected_sha256(sums, "yt-dlp_linux"), Some("bbb222".into()));
        assert_eq!(expected_sha256(sums, "yt-dlp_macos"), Some("ccc333".into()));
        assert_eq!(expected_sha256(sums, "yt-dlp.exe"), None);
    }

    #[test]
    fn the_sha256_of_abc_is_the_known_digest() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn the_tag_is_read_from_the_redirect_url() {
        assert_eq!(
            tag_from_url("https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19"),
            Some("2026.08.19")
        );
        assert_eq!(
            tag_from_url("https://github.com/yt-dlp/yt-dlp/releases/latest"),
            None
        );
    }

    #[test]
    fn the_success_message_is_user_facing() {
        assert_eq!(SUCCESS_MESSAGE, "yt-dlp updated successfully.");
    }
}
