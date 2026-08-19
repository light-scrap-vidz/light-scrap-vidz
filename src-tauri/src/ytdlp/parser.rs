use regex::Regex;
use std::sync::LazyLock;

static PROGRESS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\[download\]\s+([\d.]+)%\s+of\s+~?[\d.]+\s*\w+\s+at\s+([\d.]+\s*\w+/s|Unknown\s*B/s)\s+ETA\s+([\d:]+|Unknown)",
    )
    .unwrap()
});

static DESTINATION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[download\] Destination: (.+)$").unwrap());

// Captures the final merged filepath when yt-dlp combines video+audio streams
static MERGER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"^\[Merger\] Merging formats into "(.+)"$"#).unwrap());

static PLAYLIST_ITEM_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[download\] Downloading item (\d+) of (\d+)").unwrap());

#[derive(Debug, PartialEq)]
pub struct PlaylistItemLine {
    pub current_item: u32,
    pub total_items: u32,
}

pub fn parse_playlist_item_line(line: &str) -> Option<PlaylistItemLine> {
    let caps = PLAYLIST_ITEM_RE.captures(line.trim())?;
    let current_item: u32 = caps[1].parse().ok()?;
    let total_items: u32 = caps[2].parse().ok()?;
    Some(PlaylistItemLine {
        current_item,
        total_items,
    })
}

#[derive(Debug, PartialEq)]
pub struct ProgressLine {
    pub percent: f32,
    pub speed: String,
    pub eta: String,
}

pub fn parse_progress_line(line: &str) -> Option<ProgressLine> {
    let caps = PROGRESS_RE.captures(line.trim())?;
    let percent: f32 = caps[1].parse().ok()?;
    let speed = caps[2].trim().to_string();
    let eta = caps[3].trim().to_string();
    Some(ProgressLine {
        percent,
        speed,
        eta,
    })
}

pub fn parse_destination_line(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if let Some(caps) = MERGER_RE.captures(trimmed) {
        return Some(caps[1].trim().to_string());
    }
    let caps = DESTINATION_RE.captures(trimmed)?;
    Some(caps[1].trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_typical_progress() {
        let line = "[download]  47.3% of   18.23MiB at   1.23MiB/s ETA 00:09";
        let result = parse_progress_line(line);
        assert!(result.is_some());
        let p = result.unwrap();
        assert!((p.percent - 47.3).abs() < 0.01);
        assert!(p.speed.contains("MiB/s"));
        assert_eq!(p.eta, "00:09");
    }

    #[test]
    fn test_parse_100_percent() {
        let line = "[download] 100% of   18.23MiB at   2.45MiB/s ETA 00:00";
        let result = parse_progress_line(line);
        assert!(result.is_some());
        assert!((result.unwrap().percent - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_parse_unknown_speed_and_eta() {
        let line = "[download]   0.0% of  ~18.23MiB at  Unknown B/s ETA Unknown";
        let result = parse_progress_line(line);
        assert!(result.is_some());
        let p = result.unwrap();
        assert!((p.percent - 0.0).abs() < 0.01);
        assert_eq!(p.eta, "Unknown");
    }

    #[test]
    fn test_parse_destination() {
        let line = "[download] Destination: /home/user/Downloads/my video.mp4";
        let result = parse_destination_line(line);
        assert_eq!(
            result,
            Some("/home/user/Downloads/my video.mp4".to_string())
        );
    }

    #[test]
    fn test_non_matching_line() {
        assert!(parse_progress_line("[info] Some other line").is_none());
        assert!(parse_destination_line("[info] Some other line").is_none());
    }

    #[test]
    fn test_parse_merger_destination() {
        let line = r#"[Merger] Merging formats into "/home/user/Downloads/Big Buck Bunny.mp4""#;
        let result = parse_destination_line(line);
        assert_eq!(
            result,
            Some("/home/user/Downloads/Big Buck Bunny.mp4".to_string())
        );
    }

    #[test]
    fn test_parse_kilobytes() {
        let line = "[download]  12.5% of  500.00KiB at  256.00KiB/s ETA 00:02";
        let result = parse_progress_line(line);
        assert!(result.is_some());
        let p = result.unwrap();
        assert!((p.percent - 12.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_playlist_item() {
        let line = "[download] Downloading item 3 of 10";
        let result = parse_playlist_item_line(line);
        assert!(result.is_some());
        let p = result.unwrap();
        assert_eq!(p.current_item, 3);
        assert_eq!(p.total_items, 10);
    }

    #[test]
    fn test_parse_playlist_item_first() {
        let line = "[download] Downloading item 1 of 47";
        let result = parse_playlist_item_line(line);
        assert_eq!(
            result.unwrap(),
            PlaylistItemLine {
                current_item: 1,
                total_items: 47
            }
        );
    }

    #[test]
    fn test_parse_playlist_item_no_match() {
        assert!(
            parse_playlist_item_line("[download]  47.3% of 18.23MiB at 1.23MiB/s ETA 00:09")
                .is_none()
        );
        assert!(parse_playlist_item_line("[download] Destination: /tmp/foo.mp4").is_none());
        assert!(parse_playlist_item_line("[info] some line").is_none());
    }
}
