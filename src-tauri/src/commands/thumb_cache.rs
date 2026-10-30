use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::SystemTime;

use super::update_ytdlp::sha256_hex;

/// Nombre maximal de vignettes gardées sur disque.
pub const MAX_ENTRIES: usize = 300;

/// L'élagage lit tout le dossier : il n'a lieu qu'une écriture sur `PRUNE_EVERY`.
const PRUNE_EVERY: usize = 25;

static WRITES: AtomicUsize = AtomicUsize::new(0);

/// Fichier de cache d'une URL : le nom est le SHA-256 de l'URL, donc sans caractère risqué.
pub fn cache_file(dir: &Path, url: &str) -> PathBuf {
    dir.join(sha256_hex(url.as_bytes()))
}

/// Lit une vignette et rafraîchit sa date : l'élagage retire les moins récemment lues.
pub fn read(dir: &Path, url: &str) -> Option<Vec<u8>> {
    let path = cache_file(dir, url);
    let bytes = std::fs::read(&path)
        .ok()
        .filter(|bytes| !bytes.is_empty())?;
    if let Ok(file) = std::fs::File::options().write(true).open(&path) {
        let _ = file.set_modified(SystemTime::now());
    }
    Some(bytes)
}

/// Écrit la vignette et, de temps en temps, élague le dossier. Les erreurs sont ignorées :
/// le cache est une optimisation, jamais une condition de succès.
pub fn write(dir: &Path, url: &str, bytes: &[u8]) {
    if std::fs::create_dir_all(dir).is_err() {
        return;
    }
    let _ = std::fs::write(cache_file(dir, url), bytes);
    if WRITES.fetch_add(1, Ordering::Relaxed) % PRUNE_EVERY == PRUNE_EVERY - 1 {
        prune(dir, MAX_ENTRIES);
    }
}

/// Supprime les plus anciennes entrées au-delà de `max`.
pub fn prune(dir: &Path, max: usize) {
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<_> = read_dir
        .flatten()
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((modified, e.path()))
        })
        .collect();
    if files.len() <= max {
        return;
    }
    files.sort();
    for (_, path) in files.iter().take(files.len() - max) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_written_thumbnail_is_read_back() {
        let dir = tempfile::tempdir().unwrap();

        write(dir.path(), "https://cdn/a.jpg", b"jpeg-bytes");

        assert_eq!(
            read(dir.path(), "https://cdn/a.jpg"),
            Some(b"jpeg-bytes".to_vec())
        );
    }

    #[test]
    fn an_unknown_url_is_a_miss() {
        let dir = tempfile::tempdir().unwrap();

        assert_eq!(read(dir.path(), "https://cdn/none.jpg"), None);
    }

    #[test]
    fn an_empty_cache_file_is_a_miss() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(cache_file(dir.path(), "https://cdn/e.jpg"), b"").unwrap();

        assert_eq!(read(dir.path(), "https://cdn/e.jpg"), None);
    }

    #[test]
    fn two_urls_never_share_a_file() {
        let dir = Path::new("/c");

        assert_ne!(
            cache_file(dir, "https://a/1"),
            cache_file(dir, "https://a/2")
        );
    }

    #[test]
    fn the_file_name_is_a_plain_hash_whatever_the_url() {
        let name = cache_file(Path::new("/c"), "https://x/../../etc/passwd?a=b")
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();

        assert_eq!(name.len(), 64);
        assert!(name.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn the_oldest_entries_are_pruned_beyond_the_limit() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..5 {
            std::fs::write(dir.path().join(format!("f{i}")), b"x").unwrap();
            std::thread::sleep(std::time::Duration::from_millis(20));
        }

        prune(dir.path(), 3);

        let mut left: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        left.sort();
        assert_eq!(left, ["f2", "f3", "f4"]);
    }

    #[test]
    fn reading_an_entry_protects_it_from_the_next_prune() {
        let dir = tempfile::tempdir().unwrap();
        for u in ["a", "b", "c"] {
            write(dir.path(), u, b"x");
            std::thread::sleep(std::time::Duration::from_millis(20));
        }

        // `a` is the oldest, but it was just displayed again.
        assert!(read(dir.path(), "a").is_some());
        prune(dir.path(), 2);

        assert!(cache_file(dir.path(), "a").exists());
        assert!(!cache_file(dir.path(), "b").exists());
        assert!(cache_file(dir.path(), "c").exists());
    }
}
