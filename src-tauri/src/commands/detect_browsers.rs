use std::path::PathBuf;

/// Navigateurs reconnus (ceux dont yt-dlp lit les cookies), et les noms de binaire sous
/// lesquels ils peuvent apparaître.
const CANDIDATES: &[(&str, &[&str])] = &[
    ("firefox", &["firefox"]),
    (
        "chrome",
        &["google-chrome", "google-chrome-stable", "chrome"],
    ),
    ("chromium", &["chromium", "chromium-browser"]),
    ("brave", &["brave-browser", "brave", "brave-browser-stable"]),
    (
        "edge",
        &["microsoft-edge", "microsoft-edge-stable", "msedge"],
    ),
    ("opera", &["opera"]),
    ("vivaldi", &["vivaldi", "vivaldi-stable"]),
];

/// Liste les navigateurs détectés, `probe` répondant si un binaire est dans le PATH.
/// La sonde est injectée pour que la règle de détection se teste sans dépendre de la
/// machine qui exécute les tests.
pub fn browsers_found(probe: impl Fn(&str) -> bool) -> Vec<String> {
    let mut found = vec![];

    for (name, binaries) in CANDIDATES {
        for binary in *binaries {
            if probe(binary) {
                found.push(name.to_string());
                break;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Safari est toujours présent sur macOS.
        if !found.contains(&"safari".to_string()) {
            found.push("safari".to_string());
        }
    }

    found
}

#[tauri::command]
pub async fn detect_installed_browsers() -> Vec<String> {
    tokio::task::spawn_blocking(|| browsers_found(in_path))
        .await
        .unwrap_or_default()
}

fn in_path(binary: &str) -> bool {
    let on_path = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).any(|dir| dir.join(binary).is_file()))
        .unwrap_or(false);
    on_path || installed_as_mac_app(binary)
}

/// Nom du paquet `.app` d'un navigateur sur macOS, d'après le nom de binaire.
#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
fn mac_app_name(binary: &str) -> Option<&'static str> {
    Some(match binary {
        "firefox" => "Firefox",
        "google-chrome" => "Google Chrome",
        "chromium" => "Chromium",
        "brave-browser" => "Brave Browser",
        "microsoft-edge" => "Microsoft Edge",
        "opera" => "Opera",
        "vivaldi" => "Vivaldi",
        _ => return None,
    })
}

/// Dossiers où macOS range les applications : le système, puis celui de l'utilisateur.
#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
fn mac_app_dirs(home: Option<&str>) -> Vec<PathBuf> {
    let mut dirs = vec![PathBuf::from("/Applications")];
    if let Some(home) = home.filter(|h| !h.is_empty()) {
        dirs.push(PathBuf::from(home).join("Applications"));
    }
    dirs
}

/// Sur macOS, les navigateurs vivent dans /Applications ou ~/Applications plutôt que dans
/// le PATH.
#[cfg(target_os = "macos")]
fn installed_as_mac_app(binary: &str) -> bool {
    let Some(app) = mac_app_name(binary) else {
        return false;
    };
    let home = std::env::var("HOME").ok();
    mac_app_dirs(home.as_deref())
        .iter()
        .any(|dir| dir.join(format!("{app}.app")).exists())
}

#[cfg(not(target_os = "macos"))]
fn installed_as_mac_app(_binary: &str) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Sonde qui ne reconnaît que les binaires listés.
    fn only(names: &'static [&'static str]) -> impl Fn(&str) -> bool {
        move |b| names.contains(&b)
    }

    #[cfg(target_os = "macos")]
    const ALWAYS: &[&str] = &["safari"];
    #[cfg(not(target_os = "macos"))]
    const ALWAYS: &[&str] = &[];

    fn expected(mut names: Vec<&str>) -> Vec<String> {
        names.extend(ALWAYS);
        names.into_iter().map(String::from).collect()
    }

    #[test]
    fn nothing_installed_finds_nothing() {
        assert_eq!(browsers_found(only(&[])), expected(vec![]));
    }

    #[test]
    fn firefox_is_detected() {
        assert_eq!(
            browsers_found(only(&["firefox"])),
            expected(vec!["firefox"])
        );
    }

    #[test]
    fn each_chrome_binary_name_counts() {
        for name in ["google-chrome", "google-chrome-stable", "chrome"] {
            let names: &'static [&'static str] = Box::leak(vec![name].into_boxed_slice());
            assert_eq!(
                browsers_found(only(names)),
                expected(vec!["chrome"]),
                "{name}"
            );
        }
    }

    #[test]
    fn each_chromium_binary_name_counts() {
        for name in ["chromium", "chromium-browser"] {
            let names: &'static [&'static str] = Box::leak(vec![name].into_boxed_slice());
            assert_eq!(
                browsers_found(only(names)),
                expected(vec!["chromium"]),
                "{name}"
            );
        }
    }

    #[test]
    fn a_browser_is_listed_once_even_with_several_binaries() {
        let found = browsers_found(only(&["google-chrome", "google-chrome-stable", "chrome"]));

        assert_eq!(found, expected(vec!["chrome"]));
    }

    #[test]
    fn everything_installed_is_listed_in_a_stable_order() {
        let found = browsers_found(|_| true);

        assert_eq!(
            found,
            expected(vec![
                "firefox", "chrome", "chromium", "brave", "edge", "opera", "vivaldi"
            ])
        );
    }

    #[test]
    fn brave_edge_opera_and_vivaldi_are_detected() {
        for (binary, name) in [
            ("brave-browser", "brave"),
            ("brave", "brave"),
            ("microsoft-edge-stable", "edge"),
            ("msedge", "edge"),
            ("opera", "opera"),
            ("vivaldi-stable", "vivaldi"),
        ] {
            let names: &'static [&'static str] = Box::leak(vec![binary].into_boxed_slice());
            assert_eq!(
                browsers_found(only(names)),
                expected(vec![name]),
                "{binary}"
            );
        }
    }

    #[test]
    fn every_detected_browser_is_accepted_by_the_backend() {
        for (name, _) in CANDIDATES {
            assert!(
                crate::ytdlp::validate::BROWSERS.contains(name),
                "{name} would be refused by start_download"
            );
        }
    }

    #[test]
    fn mac_apps_are_looked_up_for_the_system_and_the_user() {
        assert_eq!(
            mac_app_dirs(Some("/Users/me")),
            [
                PathBuf::from("/Applications"),
                PathBuf::from("/Users/me/Applications")
            ]
        );
        assert_eq!(mac_app_dirs(None), [PathBuf::from("/Applications")]);
        assert_eq!(mac_app_dirs(Some("")), [PathBuf::from("/Applications")]);
    }

    #[test]
    fn every_binary_with_a_mac_app_is_a_known_browser() {
        assert_eq!(mac_app_name("brave-browser"), Some("Brave Browser"));
        assert_eq!(mac_app_name("google-chrome"), Some("Google Chrome"));
        assert_eq!(mac_app_name("lynx"), None);
    }

    #[test]
    fn an_unrelated_binary_is_ignored() {
        assert_eq!(browsers_found(only(&["lynx", "w3m"])), expected(vec![]));
    }

    #[tokio::test]
    async fn the_command_never_reports_an_unknown_browser() {
        let known = crate::ytdlp::validate::BROWSERS;

        for b in detect_installed_browsers().await {
            assert!(known.contains(&b.as_str()), "inattendu : {b}");
        }
    }
}
