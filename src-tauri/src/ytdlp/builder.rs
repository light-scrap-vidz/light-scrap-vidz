use std::convert::Infallible;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::str::FromStr;

use super::parser::{DOWNLOAD_TEMPLATE, FILE_PRINT, POSTPROCESS_TEMPLATE};

/// Platforms that require browser impersonation (curl-cffi).
const IMPERSONATE_DOMAINS: &[&str] = &["tiktok.com", "dailymotion.com", "dai.ly"];

fn needs_impersonation(url: &str) -> bool {
    let lower = url.to_lowercase();
    let rest = lower.split_once("://").map_or(lower.as_str(), |(_, r)| r);
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = host.rsplit('@').next().unwrap_or("");
    let host = host.split(':').next().unwrap_or("");
    IMPERSONATE_DOMAINS
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

/// A GUI app on macOS does not inherit the shell PATH, so a Homebrew ffmpeg or deno would be
/// invisible to yt-dlp (merging, MP3 extraction and the YouTube signature need them).
const MACOS_EXTRA_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin"];

/// `existing` suivi de `extras`, sans entrée vide : une entrée vide dans un PATH désigne le
/// dossier courant.
pub fn join_path(existing: Option<&OsStr>, extras: &[&str]) -> OsString {
    let mut dirs: Vec<PathBuf> = existing
        .map(|p| {
            std::env::split_paths(p)
                .filter(|d| !d.as_os_str().is_empty())
                .collect()
        })
        .unwrap_or_default();
    for extra in extras {
        let extra = PathBuf::from(extra);
        if !dirs.contains(&extra) {
            dirs.push(extra);
        }
    }
    std::env::join_paths(dirs).unwrap_or_default()
}

/// PATH donné aux processus lancés (yt-dlp, ffmpeg) et utilisé pour les chercher.
pub fn spawn_path() -> OsString {
    let extras: &[&str] = if cfg!(target_os = "macos") {
        MACOS_EXTRA_DIRS
    } else {
        &[]
    };
    join_path(std::env::var_os("PATH").as_deref(), extras)
}

fn in_dirs(dirs: &[PathBuf], program: &str) -> bool {
    dirs.iter().any(|d| d.join(program).is_file())
}

/// Moteur JavaScript que yt-dlp peut utiliser pour YouTube. Deno est activé par défaut ;
/// à défaut, Node ou Bun sont à désigner explicitement.
pub fn js_runtime_in(dirs: &[PathBuf]) -> Option<&'static str> {
    ["deno", "node", "bun"]
        .into_iter()
        .find(|rt| in_dirs(dirs, rt))
}

pub fn path_dirs() -> Vec<PathBuf> {
    std::env::split_paths(&spawn_path()).collect()
}

/// Début commun à toutes les commandes yt-dlp : environnement, cookies, impersonation.
fn base_command(binary: &Path, url: &str, cookies_browser: &Option<String>) -> Command {
    let mut cmd = Command::new(binary);
    cmd.env("PATH", spawn_path());
    if let Some(runtime) = js_runtime_in(&path_dirs()).filter(|rt| *rt != "deno") {
        cmd.args(["--js-runtimes", runtime]);
    }
    if let Some(browser) = cookies_browser {
        cmd.args(["--cookies-from-browser", browser]);
    }
    if needs_impersonation(url) {
        cmd.args(["--impersonate", "chrome"]);
    }
    cmd
}

#[derive(Debug, Clone, PartialEq)]
pub enum Quality {
    Best,
    P1080,
    P720,
    P480,
}

impl FromStr for Quality {
    type Err = Infallible;

    /// Toute valeur inconnue retombe sur « best » : l'interface ne peut pas envoyer pire.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            "1080p" => Self::P1080,
            "720p" => Self::P720,
            "480p" => Self::P480,
            _ => Self::Best,
        })
    }
}

impl Quality {
    pub fn format_spec(&self) -> &'static str {
        // Prefer H.264 (avc1) + AAC (mp4a) for universal MP4 compatibility.
        // YouTube serves VP9/AV1 even in MP4 containers, which breaks many players.
        // Fallbacks: any mp4 merge → any mp4 single-stream → absolute best.
        match self {
            Self::Best => {
                "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
            }
            Self::P1080 => {
                "bestvideo[height<=?1080][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=?1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=?1080][ext=mp4]/best[height<=?1080]/best"
            }
            Self::P720 => {
                "bestvideo[height<=?720][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=?720][ext=mp4]+bestaudio[ext=m4a]/best[height<=?720][ext=mp4]/best[height<=?720]/best"
            }
            Self::P480 => {
                "bestvideo[height<=?480][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=?480][ext=mp4]+bestaudio[ext=m4a]/best[height<=?480][ext=mp4]/best[height<=?480]/best"
            }
        }
    }
}

pub struct InfoCommand {
    pub binary: PathBuf,
    pub url: String,
    pub cookies_browser: Option<String>,
}

impl InfoCommand {
    pub fn build(&self) -> Command {
        let mut cmd = base_command(&self.binary, &self.url, &self.cookies_browser);
        cmd.args(["--dump-json", "--no-playlist", "--", &self.url]);
        cmd
    }
}

pub struct DownloadCommand {
    pub binary: PathBuf,
    pub url: String,
    pub output_dir: PathBuf,
    /// Dossier des fichiers intermédiaires (`.part`, flux à fusionner, ffmpeg) : propre à ce
    /// téléchargement, il est supprimé en entier quand on l'annule.
    pub temp_dir: PathBuf,
    pub quality: Quality,
    pub cookies_browser: Option<String>,
    pub audio_only: bool,
}

/// Format, progression et dossiers : identiques pour un fichier seul et pour une playlist.
fn download_args(
    cmd: &mut Command,
    quality: &Quality,
    audio_only: bool,
    output_dir: &Path,
    temp_dir: &Path,
) {
    if audio_only {
        cmd.args(["-x", "--audio-format", "mp3", "--audio-quality", "0"]);
    } else {
        cmd.args(["-f", quality.format_spec(), "--merge-output-format", "mp4"]);
    }
    cmd.args([
        "--progress",
        "--newline",
        "--progress-delta",
        "0.5",
        "--progress-template",
        DOWNLOAD_TEMPLATE,
        "--progress-template",
        POSTPROCESS_TEMPLATE,
        "--print",
        FILE_PRINT,
        "-P",
    ]);
    cmd.arg(output_dir);
    cmd.arg("-P");
    cmd.arg(format!("temp:{}", temp_dir.display()));
}

impl DownloadCommand {
    pub fn build(&self) -> Command {
        let mut cmd = base_command(&self.binary, &self.url, &self.cookies_browser);
        download_args(
            &mut cmd,
            &self.quality,
            self.audio_only,
            &self.output_dir,
            &self.temp_dir,
        );
        cmd.args([
            "-o",
            "%(title).150B [%(id)s].%(ext)s",
            "--no-playlist",
            "--",
            &self.url,
        ]);
        cmd
    }
}

/// Fetches playlist metadata without downloading videos.
pub struct PlaylistInfoCommand {
    pub binary: PathBuf,
    pub url: String,
    /// First and last entry to read (1-based, inclusive): enough to retrieve
    /// playlist_count without walking a whole profile.
    pub start: u32,
    pub end: u32,
    pub cookies_browser: Option<String>,
}

impl PlaylistInfoCommand {
    pub fn build(&self) -> Command {
        let mut cmd = base_command(&self.binary, &self.url, &self.cookies_browser);
        cmd.args([
            "--flat-playlist",
            "--dump-single-json",
            "--playlist-start",
            &self.start.to_string(),
            "--playlist-end",
            &self.end.to_string(),
            "--no-warnings",
            "--",
            &self.url,
        ]);
        cmd
    }
}

/// Downloads all or a limited set of items from a playlist / profile.
/// Items are ordered newest-first on most social platforms (Instagram, TikTok, YouTube).
/// `playlist_end = None` downloads all items; `Some(n)` limits to the first n (= latest n).
pub struct PlaylistDownloadCommand {
    pub binary: PathBuf,
    pub url: String,
    pub output_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub quality: Quality,
    pub playlist_end: Option<u32>,
    pub cookies_browser: Option<String>,
    pub audio_only: bool,
}

impl PlaylistDownloadCommand {
    pub fn build(&self) -> Command {
        let mut cmd = base_command(&self.binary, &self.url, &self.cookies_browser);
        download_args(
            &mut cmd,
            &self.quality,
            self.audio_only,
            &self.output_dir,
            &self.temp_dir,
        );
        cmd.args([
            "--yes-playlist",
            "-o",
            "%(playlist_index)s - %(title).150B [%(id)s].%(ext)s",
        ]);
        if let Some(n) = self.playlist_end {
            if n > 0 {
                cmd.args(["--playlist-end", &n.to_string()]);
            }
        }
        cmd.args(["--", &self.url]);
        cmd
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args_of(cmd: &Command) -> Vec<String> {
        cmd.get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn the_extra_dirs_follow_the_inherited_path_once() {
        let joined = join_path(
            Some(OsStr::new("/usr/bin:/bin")),
            &["/opt/homebrew/bin", "/usr/bin"],
        );

        assert_eq!(joined, OsString::from("/usr/bin:/bin:/opt/homebrew/bin"));
    }

    #[test]
    fn an_empty_or_missing_path_never_adds_the_current_directory() {
        assert_eq!(
            join_path(Some(OsStr::new("")), &["/opt/homebrew/bin"]),
            OsString::from("/opt/homebrew/bin")
        );
        assert_eq!(
            join_path(Some(OsStr::new("/usr/bin::/bin:")), &[]),
            OsString::from("/usr/bin:/bin")
        );
        assert_eq!(join_path(None, &[]), OsString::new());
    }

    #[test]
    fn the_spawned_process_gets_the_computed_path() {
        let cmd = InfoCommand {
            binary: PathBuf::from("yt-dlp"),
            url: "https://youtu.be/x".to_string(),
            cookies_browser: None,
        }
        .build();
        let path = cmd
            .get_envs()
            .find(|(k, _)| *k == "PATH")
            .and_then(|(_, v)| v)
            .unwrap()
            .to_os_string();

        assert_eq!(path, spawn_path());
        if cfg!(target_os = "macos") {
            assert!(path.to_string_lossy().contains("/opt/homebrew/bin"));
        }
    }

    #[test]
    fn deno_is_preferred_then_node_then_bun() {
        let all = tempfile::tempdir().unwrap();
        for rt in ["deno", "node", "bun"] {
            std::fs::write(all.path().join(rt), b"").unwrap();
        }
        let node_bun = tempfile::tempdir().unwrap();
        for rt in ["node", "bun"] {
            std::fs::write(node_bun.path().join(rt), b"").unwrap();
        }
        let bun = tempfile::tempdir().unwrap();
        std::fs::write(bun.path().join("bun"), b"").unwrap();
        let none = tempfile::tempdir().unwrap();

        assert_eq!(js_runtime_in(&[all.path().into()]), Some("deno"));
        assert_eq!(js_runtime_in(&[node_bun.path().into()]), Some("node"));
        assert_eq!(js_runtime_in(&[bun.path().into()]), Some("bun"));
        assert_eq!(js_runtime_in(&[none.path().into()]), None);
        assert_eq!(js_runtime_in(&[]), None);
    }

    #[test]
    fn progress_and_final_path_are_requested_in_the_parsed_format() {
        let args = args_of(
            &DownloadCommand {
                binary: PathBuf::from("yt-dlp"),
                url: "https://youtu.be/x".to_string(),
                output_dir: PathBuf::from("/out"),
                temp_dir: PathBuf::from("/out/.tmp"),
                quality: Quality::Best,
                cookies_browser: None,
                audio_only: false,
            }
            .build(),
        );

        assert!(args.contains(&DOWNLOAD_TEMPLATE.to_string()));
        assert!(args.contains(&POSTPROCESS_TEMPLATE.to_string()));
        let print = args.iter().position(|a| a == "--print").unwrap();
        assert_eq!(args[print + 1], FILE_PRINT);
    }

    #[test]
    fn intermediate_files_go_to_their_own_temp_folder() {
        for playlist in [false, true] {
            let args = if playlist {
                args_of(
                    &PlaylistDownloadCommand {
                        binary: PathBuf::from("yt-dlp"),
                        url: "https://youtube.com/@c".to_string(),
                        output_dir: PathBuf::from("/out"),
                        temp_dir: PathBuf::from("/out/.tmp"),
                        quality: Quality::Best,
                        playlist_end: None,
                        cookies_browser: None,
                        audio_only: false,
                    }
                    .build(),
                )
            } else {
                args_of(
                    &DownloadCommand {
                        binary: PathBuf::from("yt-dlp"),
                        url: "https://youtu.be/x".to_string(),
                        output_dir: PathBuf::from("/out"),
                        temp_dir: PathBuf::from("/out/.tmp"),
                        quality: Quality::Best,
                        cookies_browser: None,
                        audio_only: false,
                    }
                    .build(),
                )
            };

            assert!(args.contains(&"temp:/out/.tmp".to_string()), "{args:?}");
            let home = args.iter().position(|a| a == "/out").unwrap();
            assert_eq!(args[home - 1], "-P");
        }
    }

    #[test]
    fn impersonation_is_decided_on_the_host_only() {
        assert!(needs_impersonation("https://www.tiktok.com/@a/video/1"));
        assert!(needs_impersonation("https://dai.ly/x1"));
        assert!(!needs_impersonation("https://example.com/?ref=tiktok.com"));
        assert!(!needs_impersonation("https://nottiktok.com/x"));
    }

    #[test]
    fn the_url_comes_after_a_double_dash() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("yt-dlp"),
            url: "--exec=evil".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            cookies_browser: None,
            audio_only: false,
        };
        let args: Vec<String> = cmd
            .build()
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        let n = args.len();
        assert_eq!(args[n - 2], "--");
        assert_eq!(args[n - 1], "--exec=evil");
    }

    #[test]
    fn a_quality_cap_keeps_formats_of_unknown_height_and_falls_back() {
        let spec = Quality::P720.format_spec();
        assert!(spec.contains("height<=?720"));
        assert!(spec.ends_with("/best"));
    }

    #[test]
    fn test_quality_from_str() {
        assert_eq!(Quality::from_str("best").unwrap(), Quality::Best);
        assert_eq!(Quality::from_str("1080p").unwrap(), Quality::P1080);
        assert_eq!(Quality::from_str("720p").unwrap(), Quality::P720);
        assert_eq!(Quality::from_str("480p").unwrap(), Quality::P480);
        assert_eq!(Quality::from_str("unknown").unwrap(), Quality::Best);
    }

    #[test]
    fn test_info_command_args() {
        let cmd = InfoCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://www.youtube.com/watch?v=test".to_string(),
            cookies_browser: None,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.iter().any(|a| a == "--dump-json"));
        assert!(args.iter().any(|a| a == "--no-playlist"));
        assert!(args
            .iter()
            .any(|a| a == "https://www.youtube.com/watch?v=test"));
    }

    #[test]
    fn test_download_command_args() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://www.youtube.com/watch?v=test".to_string(),
            output_dir: PathBuf::from("/tmp/downloads"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::P1080,
            cookies_browser: None,
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"--merge-output-format".to_string()));
        assert!(args.contains(&"mp4".to_string()));
        assert!(args.contains(&"--newline".to_string()));
        assert!(args.contains(&"/tmp/downloads".to_string()));
        let spec_idx = args.iter().position(|a| a == "-f").unwrap();
        assert!(args[spec_idx + 1].contains("1080"));
    }

    #[test]
    fn test_download_command_best_quality() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://example.com".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            cookies_browser: None,
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        let spec_idx = args.iter().position(|a| a == "-f").unwrap();
        assert!(!args[spec_idx + 1].contains("height"));
    }

    #[test]
    fn test_playlist_info_command_args() {
        let cmd = PlaylistInfoCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://youtube.com/@channel".to_string(),
            start: 3,
            end: 5,
            cookies_browser: None,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"--flat-playlist".to_string()));
        assert!(args.contains(&"--dump-single-json".to_string()));
        let start = args.iter().position(|a| a == "--playlist-start").unwrap();
        assert_eq!(args[start + 1], "3");
        let end = args.iter().position(|a| a == "--playlist-end").unwrap();
        assert_eq!(args[end + 1], "5");
        assert!(!args.contains(&"--no-playlist".to_string()));
    }

    #[test]
    fn test_playlist_download_with_end() {
        let cmd = PlaylistDownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://youtube.com/@channel".to_string(),
            output_dir: PathBuf::from("/tmp/downloads"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            playlist_end: Some(10),
            cookies_browser: None,
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"--yes-playlist".to_string()));
        assert!(args.contains(&"--playlist-end".to_string()));
        assert!(args.contains(&"10".to_string()));
        assert!(!args.contains(&"--no-playlist".to_string()));
        assert!(args.iter().any(|a| a.contains("playlist_index")));
    }

    #[test]
    fn test_playlist_download_all() {
        let cmd = PlaylistDownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://youtube.com/@channel".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            playlist_end: None,
            cookies_browser: None,
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"--yes-playlist".to_string()));
        assert!(!args.contains(&"--playlist-end".to_string()));
    }

    #[test]
    fn test_cookies_from_browser_injected() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://www.instagram.com/p/test/".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            cookies_browser: Some("firefox".to_string()),
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"--cookies-from-browser".to_string()));
        let idx = args
            .iter()
            .position(|a| a == "--cookies-from-browser")
            .unwrap();
        assert_eq!(args[idx + 1], "firefox");
    }

    #[test]
    fn test_no_cookies_when_none() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://www.youtube.com/watch?v=test".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            cookies_browser: None,
            audio_only: false,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(!args.contains(&"--cookies-from-browser".to_string()));
    }

    #[test]
    fn test_audio_only_uses_extract_audio() {
        let cmd = DownloadCommand {
            binary: PathBuf::from("/usr/bin/yt-dlp"),
            url: "https://www.youtube.com/watch?v=test".to_string(),
            output_dir: PathBuf::from("/tmp"),
            temp_dir: PathBuf::from("/tmp/lsv-tmp"),
            quality: Quality::Best,
            cookies_browser: None,
            audio_only: true,
        };
        let built = cmd.build();
        let args: Vec<String> = built
            .get_args()
            .map(|a| a.to_string_lossy().into())
            .collect();
        assert!(args.contains(&"-x".to_string()));
        assert!(args.contains(&"mp3".to_string()));
        assert!(!args.contains(&"--merge-output-format".to_string()));
    }
}
