mod commands;
mod ytdlp;

use commands::deb_update::{download_deb_update, install_deb_update};
use commands::detect_browsers::detect_installed_browsers;
use commands::download::{cancel_download, start_download, DownloadRegistry};
use commands::fetch_info::fetch_video_info;
use commands::fetch_playlist_info::fetch_playlist_info;
use commands::fetch_thumbnail::fetch_thumbnail;
use commands::install_kind::install_kind;
use commands::open_file::open_file;
use commands::open_folder::open_folder;
use commands::update_ytdlp::update_ytdlp;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub fn run() {
    let download_registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(download_registry)
        .invoke_handler(tauri::generate_handler![
            fetch_video_info,
            fetch_playlist_info,
            fetch_thumbnail,
            start_download,
            cancel_download,
            open_file,
            open_folder,
            update_ytdlp,
            detect_installed_browsers,
            install_kind,
            download_deb_update,
            install_deb_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
