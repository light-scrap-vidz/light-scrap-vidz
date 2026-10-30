#!/bin/sh
# Stand-in for yt-dlp in the desktop e2e: same command line, canned answers, no network.
# A URL containing "fail" makes the download fail the way a private video does.
dir="."
tmp=""
url=""
mode="download"
while [ $# -gt 0 ]; do
  case "$1" in
    --version) echo "2099.01.01"; exit 0 ;;
    --dump-json) mode="info" ;;
    --dump-single-json) mode="playlist" ;;
    -P)
      # Two -P: the output folder, and "temp:<folder>" for the intermediate files.
      case "$2" in
        temp:*) tmp="${2#temp:}" ;;
        *) dir="$2" ;;
      esac
      shift ;;
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
    [ -n "$tmp" ] && mkdir -p "$tmp"
    file="$dir/Fake clip [fake1].mp4"
    part="${tmp:-$dir}/Fake clip [fake1].mp4"
    # Lines in the format asked through --progress-template (see src-tauri/src/ytdlp/parser.rs).
    echo "LSV_DL NA NA downloading 1048576 10485760 NA 1048576.0 9 $part"
    case "$url" in
      *slow*)
        printf 'partial' > "$part.part"
        sleep 60
        ;;
    esac
    sleep 1   # long enough for the window to draw each step, as a real download would be
    echo "LSV_DL NA NA downloading 6291456 10485760 NA 2097152.0 2 $part"
    printf 'fake video' > "$file"
    sleep 1
    echo "LSV_DL NA NA finished 10485760 10485760 NA 2097152.0 NA $part"
    sleep 1
    echo "LSV_FILE:$file"
    ;;
esac
