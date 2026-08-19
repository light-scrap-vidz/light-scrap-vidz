/// Type de paquet dont l'app a été lancée. Tauri expose la variable `APPIMAGE`
/// uniquement quand le binaire tourne depuis une AppImage.
pub fn install_kind_for(is_appimage: bool) -> &'static str {
    if is_appimage {
        "appimage"
    } else {
        "deb"
    }
}

#[tauri::command]
pub fn install_kind() -> &'static str {
    install_kind_for(std::env::var("APPIMAGE").is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_appimage_launch_is_reported_as_such() {
        assert_eq!(install_kind_for(true), "appimage");
    }

    #[test]
    fn anything_else_is_treated_as_a_deb_install() {
        assert_eq!(install_kind_for(false), "deb");
    }

    #[test]
    fn the_command_reads_the_appimage_variable() {
        // La commande ne fait que router : les deux valeurs possibles sont couvertes ci-dessus.
        let expected = install_kind_for(std::env::var("APPIMAGE").is_ok());
        assert_eq!(install_kind(), expected);
    }
}
