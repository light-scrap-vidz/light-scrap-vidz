/// Type d'installation, qui décide du mode de mise à jour : `macos` et `appimage` se mettent
/// à jour en place (artefacts signés), `deb` et `rpm` renvoient vers la page de release.
pub fn install_kind_for(is_appimage: bool, is_macos: bool, has_dpkg: bool) -> &'static str {
    if is_macos {
        "macos"
    } else if is_appimage {
        "appimage"
    } else if has_dpkg {
        "deb"
    } else {
        "rpm"
    }
}

#[tauri::command]
pub fn install_kind() -> &'static str {
    install_kind_for(
        std::env::var("APPIMAGE").is_ok(),
        cfg!(target_os = "macos"),
        std::path::Path::new("/usr/bin/dpkg").exists(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_wins_over_everything() {
        assert_eq!(install_kind_for(true, true, true), "macos");
    }

    #[test]
    fn an_appimage_launch_is_reported_as_such() {
        assert_eq!(install_kind_for(true, false, true), "appimage");
    }

    #[test]
    fn dpkg_means_a_deb_install() {
        assert_eq!(install_kind_for(false, false, true), "deb");
    }

    #[test]
    fn anything_else_on_linux_is_an_rpm_install() {
        assert_eq!(install_kind_for(false, false, false), "rpm");
    }
}
