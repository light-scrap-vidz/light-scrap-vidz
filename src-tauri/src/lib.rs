mod commands;
#[cfg(target_os = "linux")]
mod menu_style;
mod net;
mod ytdlp;

use commands::dependencies::check_dependencies;
use commands::detect_browsers::detect_installed_browsers;
use commands::download::{cancel_download, start_download, stop_all, DownloadRegistry};
use commands::fetch_info::fetch_video_info;
use commands::fetch_playlist_info::fetch_playlist_info;
use commands::fetch_slots::{cancel_lookup, kill_all, FetchSlots};
use commands::open_file::open_file;
use commands::open_folder::open_folder;
use commands::release_notes::release_notes;
use commands::thumb_cache;
use commands::thumb_protocol::{self, ThumbService};
use commands::update_ytdlp::update_ytdlp;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Manager, RunEvent};
use tokio::sync::Mutex;

pub fn run() {
    net::install_tls_provider();
    let download_registry: DownloadRegistry = Arc::new(Mutex::new(HashMap::new()));

    #[cfg(target_os = "linux")]
    menu_style::unhinted_text();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(download_registry)
        .manage(FetchSlots::default())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            menu_style::style_menu_bar();
            let cache_dir = app
                .path()
                .app_cache_dir()
                .ok()
                .map(|d| d.join("thumbnails"));
            if let Some(dir) = cache_dir.clone() {
                // Trim the cache once at startup rather than on every write.
                tauri::async_runtime::spawn_blocking(move || {
                    thumb_cache::prune(&dir, thumb_cache::MAX_ENTRIES)
                });
            }
            app.manage(Arc::new(ThumbService::new(cache_dir)?));
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("thumb", |ctx, request, responder| {
            let service = ctx
                .app_handle()
                .state::<Arc<ThumbService>>()
                .inner()
                .clone();
            let path = request.uri().path().to_string();
            tauri::async_runtime::spawn(async move {
                responder.respond(thumb_protocol::handle(&service, &path).await);
            });
        })
        .invoke_handler(tauri::generate_handler![
            fetch_video_info,
            fetch_playlist_info,
            cancel_lookup,
            start_download,
            cancel_download,
            open_file,
            open_folder,
            update_ytdlp,
            detect_installed_browsers,
            check_dependencies,
            release_notes,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        // The event loop ends with `process::exit`: no destructor runs, so `kill_on_drop`
        // never fires. Stop yt-dlp and ffmpeg (and delete their partial files) here.
        if let RunEvent::Exit = event {
            kill_all(&handle.state::<FetchSlots>());
            let registry = handle.state::<DownloadRegistry>().inner().clone();
            tauri::async_runtime::block_on(stop_all(&registry));
        }
    });
}
