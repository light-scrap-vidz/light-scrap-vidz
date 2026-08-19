/// Navigateurs reconnus, et les noms de binaire sous lesquels ils peuvent apparaître.
const CANDIDATES: &[(&str, &[&str])] = &[
    ("firefox", &["firefox"]),
    (
        "chrome",
        &["google-chrome", "google-chrome-stable", "chrome"],
    ),
    ("chromium", &["chromium", "chromium-browser"]),
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
    browsers_found(in_path)
}

fn in_path(binary: &str) -> bool {
    std::process::Command::new("which")
        .arg(binary)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
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

        assert_eq!(found, expected(vec!["firefox", "chrome", "chromium"]));
    }

    #[test]
    fn an_unrelated_binary_is_ignored() {
        assert_eq!(browsers_found(only(&["lynx", "w3m"])), expected(vec![]));
    }

    #[tokio::test]
    async fn the_command_never_reports_an_unknown_browser() {
        let known = ["firefox", "chrome", "chromium", "safari"];

        for b in detect_installed_browsers().await {
            assert!(known.contains(&b.as_str()), "inattendu : {b}");
        }
    }
}
