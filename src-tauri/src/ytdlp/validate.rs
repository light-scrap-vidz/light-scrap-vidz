//! Contrôle des paramètres envoyés par la webview avant qu'ils n'atteignent yt-dlp.

use std::path::PathBuf;

/// Navigateurs dont yt-dlp sait lire les cookies. `--cookies-from-browser` accepte aussi
/// `NAVIGATEUR:CHEMIN_DE_PROFIL` : une chaîne libre n'est donc jamais transmise telle quelle.
pub const BROWSERS: &[&str] = &[
    "firefox", "chrome", "chromium", "safari", "brave", "edge", "opera", "vivaldi",
];

pub fn cookies_browser(browser: &Option<String>) -> Result<(), String> {
    match browser {
        Some(b) if !BROWSERS.contains(&b.as_str()) => Err("Unsupported browser".to_string()),
        _ => Ok(()),
    }
}

/// Seules les adresses web sont confiées à yt-dlp.
pub fn url(raw: &str) -> Result<(), String> {
    match url::Url::parse(raw.trim()) {
        Ok(u) if matches!(u.scheme(), "http" | "https") && u.host_str().is_some() => Ok(()),
        _ => Err("Unsupported URL".to_string()),
    }
}

/// Dossier de sortie : absolu, et un dossier s'il existe (yt-dlp crée celui qui manque). Une
/// chaîne vide désignerait le dossier courant du processus.
pub fn output_dir(raw: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw);
    if raw.is_empty() || !path.is_absolute() || (path.exists() && !path.is_dir()) {
        return Err("Invalid output folder".to_string());
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_browsers_and_no_browser_pass() {
        assert!(cookies_browser(&None).is_ok());
        for b in BROWSERS {
            assert!(cookies_browser(&Some(b.to_string())).is_ok(), "{b}");
        }
    }

    #[test]
    fn a_profile_path_or_unknown_browser_is_refused() {
        for bad in [
            "firefox:/home/me/.mozilla/x",
            "netscape",
            "",
            "Firefox",
            "--exec=x",
        ] {
            assert!(cookies_browser(&Some(bad.to_string())).is_err(), "{bad}");
        }
    }

    #[test]
    fn only_web_urls_pass() {
        assert!(url("https://youtu.be/x").is_ok());
        assert!(url("http://example.com/a?b=c").is_ok());
        for bad in [
            "--exec=evil",
            "file:///etc/passwd",
            "ftp://x/y",
            "javascript:alert(1)",
            "",
            "https://",
        ] {
            assert!(url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn the_output_folder_must_be_an_absolute_path_that_is_not_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("f");
        std::fs::write(&file, b"x").unwrap();

        assert_eq!(
            output_dir(dir.path().to_str().unwrap()).unwrap(),
            dir.path()
        );
        for bad in ["", "relative/dir", ".", file.to_str().unwrap()] {
            assert!(output_dir(bad).is_err(), "{bad}");
        }
        // yt-dlp creates a folder that does not exist yet.
        assert!(output_dir("/nowhere/at/all").is_ok());
    }
}
