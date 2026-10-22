#!/bin/sh
# Stand-in for yt-dlp in the desktop e2e: same command line, canned answers, no network.
# A URL containing "fail" makes the download fail the way a private video does.
dir="."
url=""
mode="download"
while [ $# -gt 0 ]; do
  case "$1" in
    --version) echo "2099.01.01"; exit 0 ;;
    --dump-json) mode="info" ;;
    --dump-single-json) mode="playlist" ;;
    -P) dir="$2"; shift ;;
    --) shift; url="$1"; break ;;
  esac
  shift
done

case "$mode" in
  info)
    printf '{"id":"fake1","title":"Fake clip","thumbnail":"","duration":42,"uploader":"Fake channel","webpage_url":"%s","extractor":"fake","formats":[]}\n' "$url"
    ;;
  playlist)
    printf '{"_type":"playlist","title":"Fake playlist","uploader":"Fake channel","playlist_count":2,"entries":[{"id":"a","title":"First","url":"https://example.com/a"},{"id":"b","title":"Second","url":"https://example.com/b"}]}\n'
    ;;
  download)
    case "$url" in
      *fail*)
        echo "ERROR: [fake] fake1: This video is private" >&2
        exit 1
        ;;
    esac
    mkdir -p "$dir"   # like yt-dlp, which creates the output folder
    file="$dir/Fake clip [fake1].mp4"
    echo "[download] Destination: $file"
    echo "[download]  10.0% of   10.00MiB at    1.00MiB/s ETA 00:09"
    echo "[download]  60.0% of ~ 10.00MiB at    2.00MiB/s ETA 00:02 (frag 6/10)"
    printf 'fake video' > "$file"
    echo "[download] 100% of   10.00MiB in 00:00:05 at 2.00MiB/s"
    ;;
esac
