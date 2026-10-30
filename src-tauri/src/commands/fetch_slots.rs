use std::collections::HashMap;
use std::process::{Command, Output, Stdio};
use std::sync::{Arc, Mutex};

/// Un emplacement par type de recherche (« video », « playlist ») : lancer une nouvelle
/// recherche tue la précédente, qui ne servirait plus à rien.
pub type FetchSlots = Arc<Mutex<HashMap<&'static str, u32>>>;

/// Tue le groupe de processus de `pid` (yt-dlp et le ffmpeg qu'il a pu lancer).
#[cfg(unix)]
pub fn kill_group(pid: u32) {
    // SAFETY: killpg only sends a signal; a stale pid at worst matches no group.
    unsafe {
        libc::killpg(pid as libc::pid_t, libc::SIGKILL);
    }
}

#[cfg(not(unix))]
pub fn kill_group(_pid: u32) {}

/// Tue les recherches en cours : appelé à la fermeture de l'app.
pub fn kill_all(slots: &FetchSlots) {
    let pids: Vec<u32> = match slots.lock() {
        Ok(mut map) => map.drain().map(|(_, pid)| pid).collect(),
        Err(poisoned) => poisoned.into_inner().drain().map(|(_, pid)| pid).collect(),
    };
    for pid in pids {
        kill_group(pid);
    }
}

/// Abandonne la recherche `kind` en cours, s'il y en a une.
pub fn cancel(slots: &FetchSlots, kind: &str) {
    let pid = slots.lock().unwrap_or_else(|e| e.into_inner()).remove(kind);
    if let Some(pid) = pid {
        kill_group(pid);
    }
}

#[tauri::command]
pub fn cancel_lookup(slots: tauri::State<'_, FetchSlots>, kind: String) {
    cancel(&slots, &kind);
}

/// Exécute `cmd` jusqu'au bout en tant que recherche `key`, en remplaçant (et tuant) la
/// recherche précédente de même type.
pub async fn run_cancellable(
    slots: &FetchSlots,
    key: &'static str,
    cmd: Command,
) -> Result<Output, String> {
    let mut command = tokio::process::Command::from(cmd);
    #[cfg(unix)]
    command.process_group(0);
    let child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;
    let pid = child.id();

    if let Some(pid) = pid {
        let previous = slots
            .lock()
            .map_err(|_| "fetch slots poisoned".to_string())?
            .insert(key, pid);
        if let Some(old) = previous {
            kill_group(old);
        }
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {e}"));

    if let (Some(pid), Ok(mut map)) = (pid, slots.lock()) {
        if map.get(key) == Some(&pid) {
            map.remove(key);
        }
    }
    output
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn slots() -> FetchSlots {
        Arc::new(Mutex::new(HashMap::new()))
    }

    fn sh(script: &str) -> Command {
        let mut c = Command::new("/bin/sh");
        c.args(["-c", script]);
        c
    }

    #[tokio::test]
    async fn a_normal_run_returns_its_output_and_frees_the_slot() {
        let slots = slots();

        let out = run_cancellable(&slots, "video", sh("echo hello"))
            .await
            .unwrap();

        assert!(out.status.success());
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "hello");
        assert!(slots.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_new_lookup_kills_the_previous_one_of_the_same_kind() {
        let slots = slots();
        let first = {
            let slots = slots.clone();
            tokio::spawn(
                async move { run_cancellable(&slots, "video", sh("exec /bin/sleep 30")).await },
            )
        };
        tokio::time::sleep(Duration::from_millis(200)).await;
        let started = Instant::now();

        let second = run_cancellable(&slots, "video", sh("echo second"))
            .await
            .unwrap();
        let first = first.await.unwrap().unwrap();

        assert!(started.elapsed() < Duration::from_secs(10));
        assert!(
            !first.status.success(),
            "la première recherche doit avoir été tuée"
        );
        assert!(second.status.success());
    }

    #[tokio::test]
    async fn lookups_of_different_kinds_do_not_interfere() {
        let slots = slots();
        let video = {
            let slots = slots.clone();
            tokio::spawn(async move {
                run_cancellable(&slots, "video", sh("/bin/sleep 1; echo v")).await
            })
        };
        tokio::time::sleep(Duration::from_millis(100)).await;

        let playlist = run_cancellable(&slots, "playlist", sh("echo p"))
            .await
            .unwrap();

        assert!(playlist.status.success());
        assert!(video.await.unwrap().unwrap().status.success());
    }

    #[tokio::test]
    async fn abandoning_a_lookup_kills_only_that_kind() {
        let slots = slots();
        let video = {
            let slots = slots.clone();
            tokio::spawn(
                async move { run_cancellable(&slots, "video", sh("exec /bin/sleep 30")).await },
            )
        };
        let playlist = {
            let slots = slots.clone();
            tokio::spawn(async move {
                run_cancellable(&slots, "playlist", sh("/bin/sleep 1; echo p")).await
            })
        };
        tokio::time::sleep(Duration::from_millis(300)).await;

        cancel(&slots, "video");

        let video = tokio::time::timeout(Duration::from_secs(10), video)
            .await
            .expect("the lookup must end")
            .unwrap()
            .unwrap();
        assert!(!video.status.success());
        assert!(playlist.await.unwrap().unwrap().status.success());
    }

    #[test]
    fn abandoning_a_lookup_that_is_not_running_is_a_no_op() {
        cancel(&slots(), "video");
    }

    #[tokio::test]
    async fn closing_the_app_kills_the_running_lookups() {
        let slots = slots();
        let lookup = {
            let slots = slots.clone();
            tokio::spawn(
                async move { run_cancellable(&slots, "video", sh("exec /bin/sleep 30")).await },
            )
        };
        tokio::time::sleep(Duration::from_millis(200)).await;

        kill_all(&slots);

        let out = tokio::time::timeout(Duration::from_secs(10), lookup)
            .await
            .expect("the lookup must end")
            .unwrap()
            .unwrap();
        assert!(!out.status.success());
        assert!(slots.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_missing_program_is_reported() {
        let err = run_cancellable(&slots(), "video", Command::new("/nonexistent/yt-dlp"))
            .await
            .unwrap_err();

        assert!(err.starts_with("Failed to run yt-dlp"));
    }
}
