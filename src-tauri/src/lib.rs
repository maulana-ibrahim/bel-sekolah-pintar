mod audio;
mod data;
mod scheduler;
mod sounds;

use audio::Audio;
use sounds::SoundsDir;
use std::path::Path;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent,
};

/// Plays a stored sound on the speaker chosen in Settings.
pub(crate) fn play_sound_file(app: &AppHandle, name: &str) -> Result<(), String> {
    let path = app.state::<SoundsDir>().path(name)?;
    let device = app.state::<data::Store>().get().settings.audio_output_name;
    app.state::<Audio>().play(path, device)
}

/// Appends a line to `<AppData>/bel.log`. Background failures (a bell that
/// couldn't ring) have no window to show them in; this is where to look.
pub(crate) fn log(line: &str) {
    use std::io::Write;
    eprintln!("{line}");
    let Some(dir) = LOG_DIR.get() else { return };
    let stamp = chrono::Local::now().format("%F %T");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("bel.log")) {
        let _ = writeln!(f, "{stamp}  {line}");
    }
}

static LOG_DIR: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

// Commands that touch devices or files are async so they never block the UI thread.

#[tauri::command]
async fn play_sound(app: AppHandle, name: String) -> Result<(), String> {
    play_sound_file(&app, &name)
}

#[tauri::command]
fn stop_sound(audio: State<Audio>) {
    audio.stop();
}

#[tauri::command]
async fn list_output_devices() -> Vec<String> {
    audio::output_device_names()
}

/// Reads each file's header for its duration, so it runs off the UI thread.
#[tauri::command]
async fn list_sounds(app: AppHandle) -> Result<Vec<sounds::SoundInfo>, String> {
    app.state::<SoundsDir>().list_info().map_err(|e| e.to_string())
}

/// `path` comes from the file picker. Returns the stored file name.
#[tauri::command]
async fn import_sound(app: AppHandle, path: String) -> Result<String, String> {
    app.state::<SoundsDir>().import(Path::new(&path))
}

/// The UI checks the sound isn't used by any bell before calling this.
#[tauri::command]
fn delete_sound(sounds: State<SoundsDir>, name: String) -> Result<(), String> {
    sounds.delete(&name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first: a second launch focuses the running app instead of
        // starting another scheduler (which would ring every bell twice).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        // `--minimized` lets a boot launch start hidden in the tray.
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--minimized"])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let _ = LOG_DIR.set(data_dir.clone());
            let store = match data::Store::open(data_dir.join(data::DATA_FILE)) {
                Ok(store) => store,
                Err(e) => {
                    // e.g. data.json locked by antivirus. Never fall back to empty
                    // data here: the next save would overwrite the real schedule.
                    log(&format!("data.json tidak bisa dibuka: {e}"));
                    app.dialog()
                        .message(format!("Data jadwal tidak bisa dibuka:\n{e}\n\nTutup aplikasi lain yang memakai file ini, lalu buka Bel Sekolah Pintar lagi."))
                        .title("Bel Sekolah Pintar")
                        .kind(MessageDialogKind::Error)
                        .show(|_| std::process::exit(1));
                    return Ok(());
                }
            };
            app.manage(store);
            app.manage(SoundsDir::open(data_dir.join("sounds"))?);
            app.manage(Audio::spawn());
            scheduler::spawn(app.handle().clone());

            let show = MenuItem::with_id(app, "show", "Buka Bel Sekolah Pintar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Bel Sekolah Pintar")
                .menu(&Menu::with_items(app, &[&show, &quit])?)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // The window starts hidden (tauri.conf.json); show it unless launched at boot.
            if !std::env::args().any(|arg| arg == "--minimized") {
                show_main_window(app.handle());
            }
            Ok(())
        })
        // X hides to the tray; bells keep ringing. Quit is in the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            data::get_data,
            data::save_data,
            play_sound,
            stop_sound,
            list_output_devices,
            list_sounds,
            import_sound,
            delete_sound,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
