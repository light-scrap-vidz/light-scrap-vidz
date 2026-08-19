use std::path::PathBuf;

pub fn deb_tmp_path(version: &str) -> PathBuf {
    std::env::temp_dir().join(format!("light-scrap-vidz_{version}.deb"))
}

pub fn deb_url(version: &str) -> String {
    format!(
        "https://github.com/sindus/light-scrap-vidz/releases/download/v{version}/light-scrap-vidz_{version}_amd64.deb"
    )
}

/// Traduit la sortie d'un sous-processus en résultat. Séparé des commandes pour que la
/// mise en forme des erreurs soit testable sans lancer `curl` ni `pkexec`.
pub fn interpret(action: &str, success: bool, stderr: &[u8]) -> Result<(), String> {
    if success {
        return Ok(());
    }
    Err(format!(
        "{action} failed: {}",
        String::from_utf8_lossy(stderr).trim()
    ))
}

/// Chemin passé à `curl`, avec un repli si le chemin temporaire n'est pas de l'UTF-8.
pub fn curl_destination(dest: &std::path::Path) -> &str {
    dest.to_str().unwrap_or("/tmp/light-scrap-vidz.deb")
}

/// Arguments de téléchargement du paquet. Séparé de la commande pour que les garde-fous
/// (suivi de redirection, échec sur 4xx, timeout de connexion) soient vérifiables.
pub fn curl_args<'a>(dest: &'a str, url: &'a str) -> Vec<&'a str> {
    vec!["-L", "-f", "--connect-timeout", "30", "-o", dest, url]
}

/// Arguments d'installation, exécutés sous `pkexec` (dialogue de mot de passe système).
pub fn dpkg_args(path: &str) -> Vec<&str> {
    vec!["dpkg", "-i", path]
}

/// Downloads the .deb for `version` to a temp file. Returns the temp path.
#[tauri::command]
pub async fn download_deb_update(version: String) -> Result<String, String> {
    let url = deb_url(&version);
    let dest = deb_tmp_path(&version);

    let out = tokio::process::Command::new("curl")
        .args(curl_args(curl_destination(&dest), &url))
        .output()
        .await
        .map_err(|e| format!("curl not found: {e}"))?;

    interpret("Download", out.status.success(), &out.stderr)?;

    Ok(dest.to_string_lossy().into_owned())
}

/// Installs the previously downloaded .deb using pkexec (shows a system password dialog).
#[tauri::command]
pub async fn install_deb_update(version: String) -> Result<(), String> {
    let path = deb_tmp_path(&version);

    let out = tokio::process::Command::new("pkexec")
        .args(dpkg_args(path.to_str().unwrap_or_default()))
        .output()
        .await
        .map_err(|e| format!("pkexec not found: {e}"))?;

    // Le .deb est retiré quoi qu'il arrive : inutile de laisser traîner un paquet
    // dans /tmp après un échec d'installation.
    let _ = std::fs::remove_file(&path);

    interpret("Install", out.status.success(), &out.stderr)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_temp_path_carries_the_version() {
        let path = deb_tmp_path("1.2.3");

        assert_eq!(path.file_name().unwrap(), "light-scrap-vidz_1.2.3.deb");
        assert_eq!(path.parent().unwrap(), std::env::temp_dir());
    }

    #[test]
    fn two_versions_do_not_share_a_temp_file() {
        assert_ne!(deb_tmp_path("1.0.0"), deb_tmp_path("1.0.1"));
    }

    #[test]
    fn the_release_url_points_at_the_tagged_amd64_package() {
        let url = deb_url("2.0.5");

        assert_eq!(
            url,
            "https://github.com/sindus/light-scrap-vidz/releases/download/v2.0.5/light-scrap-vidz_2.0.5_amd64.deb"
        );
    }

    #[test]
    fn the_url_and_the_temp_file_agree_on_the_package_name() {
        let url = deb_url("3.1.4");
        let file = deb_tmp_path("3.1.4");

        assert!(url.contains("3.1.4"));
        assert!(file.to_str().unwrap().contains("3.1.4"));
    }

    #[test]
    fn a_successful_run_is_reported_as_ok() {
        assert!(interpret("Download", true, b"peu importe").is_ok());
    }

    #[test]
    fn a_failure_quotes_the_trimmed_stderr() {
        let err = interpret("Download", false, b"  404 Not Found\n").unwrap_err();

        assert_eq!(err, "Download failed: 404 Not Found");
    }

    #[test]
    fn a_failure_without_stderr_still_names_the_action() {
        assert_eq!(
            interpret("Install", false, b"").unwrap_err(),
            "Install failed: "
        );
    }

    #[test]
    fn invalid_utf8_in_stderr_does_not_panic() {
        let err = interpret("Install", false, &[0xff, 0xfe, b'x']).unwrap_err();

        assert!(err.starts_with("Install failed:"));
    }

    #[test]
    fn the_curl_destination_is_the_temp_path() {
        let dest = deb_tmp_path("9.9.9");

        assert_eq!(curl_destination(&dest), dest.to_str().unwrap());
    }

    #[test]
    fn the_download_follows_redirects_and_fails_on_a_4xx() {
        let args = curl_args("/tmp/pkg.deb", "https://host/pkg.deb");

        assert!(args.contains(&"-L"));
        assert!(args.contains(&"-f"));
    }

    #[test]
    fn the_download_has_a_connection_timeout() {
        let args = curl_args("/tmp/pkg.deb", "https://host/pkg.deb");
        let i = args.iter().position(|a| *a == "--connect-timeout").unwrap();

        assert_eq!(args[i + 1], "30");
    }

    #[test]
    fn the_download_writes_to_the_given_destination() {
        let args = curl_args("/tmp/pkg.deb", "https://host/pkg.deb");
        let i = args.iter().position(|a| *a == "-o").unwrap();

        assert_eq!(args[i + 1], "/tmp/pkg.deb");
        assert_eq!(args.last(), Some(&"https://host/pkg.deb"));
    }

    #[test]
    fn the_install_runs_dpkg_on_the_downloaded_package() {
        assert_eq!(dpkg_args("/tmp/pkg.deb"), ["dpkg", "-i", "/tmp/pkg.deb"]);
    }

    #[cfg(unix)]
    #[test]
    fn a_non_utf8_destination_falls_back_to_a_fixed_path() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let bad = PathBuf::from(OsStr::from_bytes(&[0xff, 0xfe]));

        assert_eq!(curl_destination(&bad), "/tmp/light-scrap-vidz.deb");
    }
}
