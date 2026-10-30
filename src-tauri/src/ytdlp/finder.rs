use std::path::{Path, PathBuf};
use tauri::Manager;

const SYSTEM_PATHS: &[&str] = &[
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/opt/homebrew/bin/yt-dlp",
    "/opt/local/bin/yt-dlp",
];

fn modified(path: &Path) -> std::time::SystemTime {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(std::time::UNIX_EPOCH)
}

pub struct YtDlpBinary {
    path: PathBuf,
}

impl YtDlpBinary {
    /// Ordre de résolution, à partir des emplacements candidats déjà résolus.
    ///
    /// Extrait de `find_with_app` : les dossiers de l'application ne sont pas inscriptibles
    /// sous l'app mock de Tauri (`/usr/lib/test`), donc la règle de priorité ne peut se
    /// vérifier qu'en lui passant des dossiers choisis par le test.
    pub fn resolve(data_dir: Option<&Path>, resource_dir: Option<&Path>) -> Result<Self, String> {
        // 1. Variable d'environnement (dev/CI)
        if let Ok(p) = std::env::var("YTDLP_PATH") {
            let path = PathBuf::from(&p);
            if path.is_file() {
                return Ok(Self { path });
            }
        }

        // 2-3. Binaire mis à jour par l'utilisateur (dossier de données) et sidecar embarqué.
        //    Le plus récent des deux gagne : une mise à jour de l'app livre un sidecar plus
        //    frais qu'un vieux binaire téléchargé, et « Update yt-dlp » dépasse le sidecar.
        //    Le sidecar est nommé `yt-dlp-lsv` pour ne pas entrer en conflit avec le paquet
        //    système /usr/bin/yt-dlp ; Tauri l'installe à côté de l'exécutable, d'où le
        //    dossier de ressources et celui de l'exécutable.
        let mut sidecar_dirs: Vec<PathBuf> =
            resource_dir.map(Path::to_path_buf).into_iter().collect();
        if let Some(dir) = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
        {
            sidecar_dirs.push(dir);
        }
        let sidecar = sidecar_dirs
            .iter()
            .map(|d| d.join("yt-dlp-lsv"))
            .find(|p| p.is_file());
        let updated = data_dir.map(|d| d.join("yt-dlp")).filter(|p| p.is_file());
        match (updated, sidecar) {
            (Some(u), Some(sc)) => {
                let path = if modified(&u) >= modified(&sc) { u } else { sc };
                return Ok(Self { path });
            }
            (Some(path), None) | (None, Some(path)) => return Ok(Self { path }),
            (None, None) => {}
        }

        // 4. Repli sur le système (builds de dev sans binaire embarqué)
        Self::find_system()
    }

    /// Primary resolver: the more recent of the bundled sidecar and the user-updated binary,
    /// then the system one.
    ///
    /// Générique sur le runtime : la résolution ne dépend pas de Wry, ce qui permet de la
    /// couvrir avec l'app mock de Tauri.
    pub fn find_with_app<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Self, String> {
        Self::resolve(
            app.path().app_data_dir().ok().as_deref(),
            app.path().resource_dir().ok().as_deref(),
        )
    }

    #[cfg(test)]
    pub fn find() -> Result<Self, String> {
        Self::resolve(None, None)
    }

    fn find_system() -> Result<Self, String> {
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in path_var.split(':') {
                let candidate = PathBuf::from(dir).join("yt-dlp");
                if candidate.is_file() {
                    return Ok(Self { path: candidate });
                }
            }
        }
        for p in SYSTEM_PATHS {
            let candidate = Path::new(p);
            if candidate.is_file() {
                return Ok(Self {
                    path: candidate.to_path_buf(),
                });
            }
        }
        Err(
            "yt-dlp not found. Open Settings and click \"Check for updates\" to download it."
                .to_string(),
        )
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard, OnceLock};

    /// `find` reads process-wide environment variables, so the tests that set them
    /// must not run at the same time as each other.
    fn env_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    /// Restores `YTDLP_PATH` and `PATH` when the test ends, however it ends.
    struct EnvGuard {
        ytdlp: Option<String>,
        path: Option<String>,
        _lock: MutexGuard<'static, ()>,
    }

    impl EnvGuard {
        fn new() -> Self {
            Self {
                ytdlp: std::env::var("YTDLP_PATH").ok(),
                path: std::env::var("PATH").ok(),
                _lock: env_lock(),
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            match &self.ytdlp {
                Some(v) => std::env::set_var("YTDLP_PATH", v),
                None => std::env::remove_var("YTDLP_PATH"),
            }
            match &self.path {
                Some(v) => std::env::set_var("PATH", v),
                None => std::env::remove_var("PATH"),
            }
        }
    }

    /// An executable-looking file named `yt-dlp` inside a fresh directory.
    fn fake_binary(dir: &std::path::Path) -> PathBuf {
        let path = dir.join("yt-dlp");
        std::fs::write(&path, b"#!/bin/sh\nexit 0\n").unwrap();
        path
    }

    #[test]
    fn uses_the_env_var_when_it_points_at_a_real_file() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let binary = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", &binary);

        let found = YtDlpBinary::find().unwrap();

        assert_eq!(found.path(), binary);
    }

    #[test]
    fn ignores_an_env_var_pointing_nowhere() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let on_path = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", "/nonexistent/path/yt-dlp");
        std::env::set_var("PATH", dir.path());

        let found = YtDlpBinary::find().unwrap();

        assert_eq!(found.path(), on_path);
    }

    #[test]
    fn falls_back_to_the_first_match_on_path() {
        let _guard = EnvGuard::new();
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let expected = fake_binary(first.path());
        fake_binary(second.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var(
            "PATH",
            format!("{}:{}", first.path().display(), second.path().display()),
        );

        let found = YtDlpBinary::find().unwrap();

        assert_eq!(found.path(), expected);
    }

    #[test]
    fn skips_path_entries_that_hold_no_binary() {
        let _guard = EnvGuard::new();
        let empty = tempfile::tempdir().unwrap();
        let real = tempfile::tempdir().unwrap();
        let expected = fake_binary(real.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var(
            "PATH",
            format!("{}:{}", empty.path().display(), real.path().display()),
        );

        let found = YtDlpBinary::find().unwrap();

        assert_eq!(found.path(), expected);
    }

    #[test]
    fn a_directory_named_yt_dlp_is_not_mistaken_for_the_binary() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("yt-dlp")).unwrap();
        let real = tempfile::tempdir().unwrap();
        let expected = fake_binary(real.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var(
            "PATH",
            format!("{}:{}", dir.path().display(), real.path().display()),
        );

        let found = YtDlpBinary::find().unwrap();

        assert_eq!(found.path(), expected);
    }

    #[test]
    fn the_resolved_path_is_exposed_to_callers() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let binary = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", &binary);

        let found = YtDlpBinary::find().unwrap();

        assert!(found.path().ends_with("yt-dlp"));
        assert!(found.path().is_absolute());
    }

    // ── résolution via l'AppHandle ───────────────────────────────────────────

    /// Écarte les dossiers de l'app hors du chemin : les tests ne doivent pas dépendre
    /// d'un binaire réellement installé sur la machine.
    fn no_system_ytdlp() -> tempfile::TempDir {
        let empty = tempfile::tempdir().unwrap();
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var("PATH", empty.path());
        empty
    }

    #[test]
    fn the_env_var_wins_over_everything_else() {
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();
        let dir = tempfile::tempdir().unwrap();
        let binary = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", &binary);
        // Un binaire existe aussi dans les deux dossiers de l'app : la variable prime.
        let data = tempfile::tempdir().unwrap();
        fake_binary(data.path());
        let res = tempfile::tempdir().unwrap();
        std::fs::write(res.path().join("yt-dlp-lsv"), b"#!/bin/sh\n").unwrap();

        let found = YtDlpBinary::resolve(Some(data.path()), Some(res.path())).unwrap();

        assert_eq!(found.path(), binary);
    }

    #[test]
    fn the_updated_binary_in_the_data_dir_comes_before_the_sidecar() {
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();
        let res = tempfile::tempdir().unwrap();
        std::fs::write(res.path().join("yt-dlp-lsv"), b"#!/bin/sh\n").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(50));
        let data = tempfile::tempdir().unwrap();
        let updated = fake_binary(data.path());

        let found = YtDlpBinary::resolve(Some(data.path()), Some(res.path())).unwrap();

        assert_eq!(found.path(), updated);
    }

    #[test]
    fn a_sidecar_newer_than_the_downloaded_binary_wins() {
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();
        let data = tempfile::tempdir().unwrap();
        fake_binary(data.path());
        std::thread::sleep(std::time::Duration::from_millis(50));
        let res = tempfile::tempdir().unwrap();
        let sidecar = res.path().join("yt-dlp-lsv");
        std::fs::write(&sidecar, b"#!/bin/sh\n").unwrap();

        let found = YtDlpBinary::resolve(Some(data.path()), Some(res.path())).unwrap();

        assert_eq!(found.path(), sidecar);
    }

    #[test]
    fn the_bundled_sidecar_is_used_when_the_data_dir_is_empty() {
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();
        let data = tempfile::tempdir().unwrap();
        let res = tempfile::tempdir().unwrap();
        let sidecar = res.path().join("yt-dlp-lsv");
        std::fs::write(&sidecar, b"#!/bin/sh\n").unwrap();

        let found = YtDlpBinary::resolve(Some(data.path()), Some(res.path())).unwrap();

        assert_eq!(found.path(), sidecar);
    }

    #[test]
    fn a_sidecar_named_yt_dlp_is_not_picked_up() {
        // Le sidecar doit s'appeler `yt-dlp-lsv` ; le nom nu est réservé au paquet système.
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();
        let res = tempfile::tempdir().unwrap();
        fake_binary(res.path());

        let resolved = YtDlpBinary::resolve(None, Some(res.path()));

        assert!(resolved.is_err() || resolved.unwrap().path() != res.path().join("yt-dlp"));
    }

    #[test]
    fn the_system_path_is_the_last_resort() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let on_path = fake_binary(dir.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var("PATH", dir.path());
        let data = tempfile::tempdir().unwrap();
        let res = tempfile::tempdir().unwrap();

        let found = YtDlpBinary::resolve(Some(data.path()), Some(res.path())).unwrap();

        assert_eq!(found.path(), on_path);
    }

    #[test]
    fn absent_app_directories_are_skipped() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let on_path = fake_binary(dir.path());
        std::env::remove_var("YTDLP_PATH");
        std::env::set_var("PATH", dir.path());

        let found = YtDlpBinary::resolve(None, None).unwrap();

        assert_eq!(found.path(), on_path);
    }

    #[test]
    fn the_app_handle_feeds_resolve_with_its_own_directories() {
        let _guard = EnvGuard::new();
        let dir = tempfile::tempdir().unwrap();
        let binary = fake_binary(dir.path());
        std::env::set_var("YTDLP_PATH", &binary);
        let app = tauri::test::mock_app();

        let found = YtDlpBinary::find_with_app(app.handle()).unwrap();

        assert_eq!(found.path(), binary);
    }

    #[test]
    fn a_missing_binary_produces_an_actionable_message() {
        let _guard = EnvGuard::new();
        let _empty = no_system_ytdlp();

        // On ne peut pas garantir l'absence des chemins système (/usr/bin/yt-dlp) sur la
        // machine de test : on ne vérifie le message que s'il n'y en a effectivement aucun.
        match YtDlpBinary::resolve(None, None) {
            Err(msg) => assert!(msg.contains("yt-dlp not found"), "{msg}"),
            Ok(found) => assert!(SYSTEM_PATHS.contains(&found.path().to_str().unwrap())),
        }
    }
}
