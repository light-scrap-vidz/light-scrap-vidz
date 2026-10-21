/// URI `file://` d'un chemin, avec échappement des octets hors alphabet sûr.
pub fn file_uri(path: &str) -> String {
    let mut uri = String::from("file://");
    for byte in path.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                uri.push(byte as char)
            }
            other => uri.push_str(&format!("%{other:02X}")),
        }
    }
    uri
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_path_is_kept() {
        assert_eq!(file_uri("/home/me/Clip.mp4"), "file:///home/me/Clip.mp4");
    }

    #[test]
    fn spaces_and_specials_are_escaped() {
        assert_eq!(
            file_uri("/home/me/My Clip #1.mp4"),
            "file:///home/me/My%20Clip%20%231.mp4"
        );
    }

    #[test]
    fn non_ascii_bytes_are_escaped_one_by_one() {
        assert_eq!(file_uri("/é"), "file:///%C3%A9");
    }
}
