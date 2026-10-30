//! Lecture de la sortie de yt-dlp.
//!
//! La progression ne vient pas des lignes `[download] 47% of …`, dont le format varie
//! (taille inconnue, estimation, fragments, ligne finale sans ETA) : on demande à yt-dlp un
//! modèle fixe (`--progress-template`), donc des valeurs brutes, et le chemin final exact
//! du fichier (`--print after_move:`), une fois déplacé.

/// Une ligne de progression de téléchargement. Les champs sont séparés par une espace ;
/// `NA` marque une valeur absente ; le nom de fichier, qui peut contenir des espaces, vient
/// en dernier.
pub const DOWNLOAD_TEMPLATE: &str = "download:LSV_DL %(info.playlist_index)s %(info.n_entries)s %(progress.status)s %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s %(progress.filename)s";

/// Début et fin d'une étape de post-traitement (fusion, conversion…).
pub const POSTPROCESS_TEMPLATE: &str =
    "postprocess:LSV_PP %(progress.postprocessor)s %(progress.status)s";

/// Chemin final de chaque fichier produit, une fois déplacé dans le dossier de sortie.
pub const FILE_PRINT: &str = "after_move:LSV_FILE:%(filepath)s";

#[derive(Debug, PartialEq)]
pub struct DownloadLine {
    pub item: Option<u32>,
    pub total_items: Option<u32>,
    pub finished: bool,
    pub downloaded: f64,
    /// Taille exacte, ou à défaut l'estimation.
    pub total: Option<f64>,
    pub speed: Option<f64>,
    pub eta: Option<u64>,
    pub filename: String,
}

fn number(token: &str) -> Option<f64> {
    token.parse::<f64>().ok().filter(|n| n.is_finite())
}

pub fn parse_download_line(line: &str) -> Option<DownloadLine> {
    let rest = line.trim().strip_prefix("LSV_DL ")?;
    let mut parts = rest.splitn(9, ' ');
    let item = parts.next()?.parse().ok();
    let total_items = parts.next()?.parse().ok();
    let status = parts.next()?;
    let downloaded = number(parts.next()?)?;
    let exact = number(parts.next()?);
    let estimate = number(parts.next()?);
    let speed = number(parts.next()?);
    let eta = number(parts.next()?).map(|s| s.max(0.0) as u64);
    let filename = parts.next()?.trim().to_string();
    Some(DownloadLine {
        item,
        total_items,
        finished: status == "finished",
        downloaded,
        total: exact.or(estimate).filter(|t| *t > 0.0),
        speed,
        eta,
        filename,
    })
}

/// Nombre de flux à télécharger pour l'élément dont `filename` est le fichier en cours.
/// Quand vidéo et audio sont téléchargés à part, yt-dlp nomme chaque flux `… [id].f137.mp4`
/// avant de les fusionner ; l'identifiant du format que donne le modèle est celui du flux en
/// cours seulement, donc inutilisable pour compter.
pub fn stream_count(filename: &str) -> u32 {
    let name = filename.rsplit('/').next().unwrap_or(filename);
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    match stem.rsplit_once(".f") {
        Some((_, id))
            if !id.is_empty()
                && id
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') =>
        {
            2
        }
        _ => 1,
    }
}

#[derive(Debug, PartialEq)]
pub struct PostprocessLine {
    pub processor: String,
    pub started: bool,
}

pub fn parse_postprocess_line(line: &str) -> Option<PostprocessLine> {
    let rest = line.trim().strip_prefix("LSV_PP ")?;
    let (processor, status) = rest.split_once(' ')?;
    Some(PostprocessLine {
        processor: processor.to_string(),
        started: status.trim() == "started",
    })
}

/// Étape affichée pour un post-processeur de yt-dlp ; `None` pour ceux qui ne méritent pas
/// d'être annoncés (déplacement du fichier…).
pub fn stage_for(processor: &str) -> Option<&'static str> {
    match processor {
        "Merger" => Some("merging"),
        "ExtractAudio" | "VideoConvertor" | "VideoRemuxer" => Some("converting"),
        p if p.starts_with("Fixup") => Some("fixing"),
        "Metadata" | "EmbedSubtitle" | "EmbedThumbnail" | "ModifyChapters" | "SponsorBlock" => {
            Some("processing")
        }
        _ => None,
    }
}

/// Chemin final annoncé par `--print after_move:`.
pub fn parse_file_line(line: &str) -> Option<String> {
    let path = line.trim().strip_prefix("LSV_FILE:")?.trim();
    (!path.is_empty()).then(|| path.to_string())
}

/// Taille lisible, au format de yt-dlp (`18.23MiB`).
pub fn format_bytes(bytes: f64) -> String {
    const UNITS: [&str; 5] = ["B", "KiB", "MiB", "GiB", "TiB"];
    let mut value = bytes.max(0.0);
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{value:.0}B")
    } else {
        format!("{value:.2}{}", UNITS[unit])
    }
}

pub fn format_speed(bytes_per_second: f64) -> String {
    format!("{}/s", format_bytes(bytes_per_second))
}

/// Durée restante : `MM:SS`, ou `H:MM:SS` au-delà d'une heure.
pub fn format_eta(seconds: u64) -> String {
    let (h, m, s) = (seconds / 3600, seconds % 3600 / 60, seconds % 60);
    if h > 0 {
        format!("{h}:{m:02}:{s:02}")
    } else {
        format!("{m:02}:{s:02}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Lines as printed by yt-dlp 2026.10.21 with the templates above.
    const FIRST: &str =
        "LSV_DL NA NA downloading 1024 433081 NA NA NA /out/.tmp/Me at the zoo [x].f137.mp4";
    const ESTIMATED: &str =
        "LSV_DL 2 5 downloading 56180 NA 167472.0 295137.77490173467 12 /out/.tmp/a b.mp4";
    const FINISHED: &str =
        "LSV_DL 1 2 finished 187443 187443 NA 2130656.0991243687 NA /out/.tmp/c.webm";

    #[test]
    fn a_first_progress_line_has_no_speed_yet() {
        let l = parse_download_line(FIRST).unwrap();

        assert_eq!(l.item, None);
        assert_eq!(l.total_items, None);
        assert!(!l.finished);
        assert_eq!(l.downloaded, 1024.0);
        assert_eq!(l.total, Some(433081.0));
        assert_eq!(l.speed, None);
        assert_eq!(l.eta, None);
        assert_eq!(l.filename, "/out/.tmp/Me at the zoo [x].f137.mp4");
    }

    #[test]
    fn an_estimated_size_stands_in_for_a_missing_exact_one() {
        let l = parse_download_line(ESTIMATED).unwrap();

        assert_eq!(l.item, Some(2));
        assert_eq!(l.total_items, Some(5));
        assert_eq!(l.total, Some(167472.0));
        assert_eq!(l.eta, Some(12));
        assert_eq!(l.filename, "/out/.tmp/a b.mp4");
    }

    #[test]
    fn the_final_line_of_a_stream_is_marked_finished() {
        let l = parse_download_line(FINISHED).unwrap();

        assert!(l.finished);
        assert_eq!(l.downloaded, l.total.unwrap());
    }

    #[test]
    fn a_download_of_unknown_size_has_no_total() {
        let l = parse_download_line(
            "LSV_DL NA NA downloading 12582912 NA NA 1258291.2 NA /out/live.mp4",
        )
        .unwrap();

        assert_eq!(l.total, None);
        assert_eq!(l.downloaded, 12582912.0);
    }

    #[test]
    fn a_zero_total_is_treated_as_unknown() {
        let l = parse_download_line("LSV_DL NA NA downloading 10 0 NA NA NA /f.mp4").unwrap();

        assert_eq!(l.total, None);
    }

    #[test]
    fn lines_that_are_not_progress_are_ignored() {
        for line in [
            "",
            "[youtube] Extracting URL: https://y.tld/watch?v=x",
            "[download]  47.3% of   18.23MiB at   1.23MiB/s ETA 00:09",
            "LSV_DL",
            "LSV_DL NA NA downloading",
            "LSV_DL NA NA downloading abc NA NA NA NA /f.mp4",
            "LSV_PP Merger started",
            "WARNING: LSV_DL NA",
        ] {
            assert!(parse_download_line(line).is_none(), "{line:?}");
        }
    }

    #[test]
    fn separate_video_and_audio_streams_are_recognised_by_their_file_names() {
        assert_eq!(stream_count("/out/.tmp/Me at the zoo [x].f137.mp4"), 2);
        assert_eq!(stream_count("/out/.tmp/Me at the zoo [x].f140.m4a"), 2);
        assert_eq!(stream_count("/out/.tmp/Clip [x].fhls-720_0.mp4"), 2);
        assert_eq!(stream_count("/out/.tmp/Clip [x].mp4"), 1);
        assert_eq!(stream_count("/out/.tmp/my.file [x].mp4"), 1);
        assert_eq!(stream_count("/out/.tmp/Clip [x].f.mp4"), 1);
        assert_eq!(stream_count(""), 1);
    }

    #[test]
    fn postprocess_lines_name_the_step_and_whether_it_started() {
        assert_eq!(
            parse_postprocess_line("LSV_PP Merger started"),
            Some(PostprocessLine {
                processor: "Merger".into(),
                started: true
            })
        );
        assert!(
            !parse_postprocess_line("LSV_PP MoveFiles finished")
                .unwrap()
                .started
        );
        assert!(parse_postprocess_line("[Merger] Merging formats").is_none());
        assert!(parse_postprocess_line("LSV_PP").is_none());
    }

    #[test]
    fn steps_are_announced_by_kind() {
        assert_eq!(stage_for("Merger"), Some("merging"));
        assert_eq!(stage_for("ExtractAudio"), Some("converting"));
        assert_eq!(stage_for("VideoConvertor"), Some("converting"));
        assert_eq!(stage_for("FixupM4a"), Some("fixing"));
        assert_eq!(stage_for("FixupDuration"), Some("fixing"));
        assert_eq!(stage_for("Metadata"), Some("processing"));
        assert_eq!(stage_for("MoveFiles"), None);
        assert_eq!(stage_for("Concat"), None);
    }

    #[test]
    fn the_final_path_is_read_from_the_print_line() {
        assert_eq!(
            parse_file_line("LSV_FILE:/home/me/Clip [id].mp4"),
            Some("/home/me/Clip [id].mp4".to_string())
        );
        assert_eq!(parse_file_line("LSV_FILE:"), None);
        assert_eq!(parse_file_line("[download] Destination: /x.mp4"), None);
    }

    #[test]
    fn sizes_use_the_binary_units_of_yt_dlp() {
        assert_eq!(format_bytes(0.0), "0B");
        assert_eq!(format_bytes(512.0), "512B");
        assert_eq!(format_bytes(1024.0), "1.00KiB");
        assert_eq!(format_bytes(19_114_393.0), "18.23MiB");
        assert_eq!(format_bytes(3.0 * 1024.0 * 1024.0 * 1024.0), "3.00GiB");
        assert_eq!(format_speed(1_289_748.0), "1.23MiB/s");
        assert_eq!(format_bytes(-5.0), "0B");
    }

    #[test]
    fn the_remaining_time_gains_an_hour_field_when_needed() {
        assert_eq!(format_eta(9), "00:09");
        assert_eq!(format_eta(754), "12:34");
        assert_eq!(format_eta(3725), "1:02:05");
    }
}
