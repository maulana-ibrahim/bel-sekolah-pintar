//! App data persisted as one JSON file in AppData.
//!
//! Rust owns the file: the UI reads it with `get_data` and replaces it with
//! `save_data`. Validation rules (conflicting bells, sound in use, …) live in
//! the UI's `src/lib/data.ts`; serde only guarantees the shape here.

use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::State;

pub const DATA_FILE: &str = "data.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Bell {
    pub id: String,
    /// "HH:mm", 24-hour.
    pub time: String,
    pub label: String,
    pub sound_file_name: String,
    /// 1 = Monday … 7 = Sunday (ISO weekday).
    pub days: Vec<u8>,
    /// Id of one of `Settings::categories` (UI color group only).
    /// Defaulted so files saved before this field existed still load.
    #[serde(default = "default_category")]
    pub category: String,
}

fn default_category() -> String {
    "masuk".into()
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub bells: Vec<Bell>,
}

/// Manual bell button on the dashboard.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuickBell {
    pub id: String,
    pub label: String,
    pub sound_file_name: String,
    /// UI only: "blue" | "sun" | "green" | "coral".
    #[serde(default = "default_quick_color")]
    pub color: String,
    /// UI only: icon key from the UI's icon list.
    #[serde(default = "default_quick_icon")]
    pub icon: String,
}

fn default_quick_color() -> String {
    "coral".into()
}

fn default_quick_icon() -> String {
    "siren".into()
}

/// User-editable bell type ("Masuk", "Istirahat", …). UI only: the scheduler
/// ignores it.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    /// "#rrggbb".
    pub color: String,
}

/// The four types bells had before they became editable. Their ids match the
/// old fixed `category` values, so older files need no conversion.
fn default_categories() -> Vec<Category> {
    [
        ("masuk", "Masuk", "#2f6bff"),
        ("istirahat", "Istirahat", "#ffc53d"),
        ("ibadah", "Ibadah", "#12a37f"),
        ("pulang", "Pulang", "#ff6b4a"),
    ]
    .map(|(id, name, color)| Category { id: id.into(), name: name.into(), color: color.into() })
    .into()
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Output device name; empty = system default.
    #[serde(default)]
    pub audio_output_name: String,
    pub active_template_id: String,
    #[serde(default)]
    pub quick_bells: Vec<QuickBell>,
    #[serde(default = "default_categories")]
    pub categories: Vec<Category>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub settings: Settings,
    pub templates: Vec<Template>,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            settings: Settings {
                audio_output_name: String::new(),
                active_template_id: "reguler".into(),
                quick_bells: Vec::new(),
                categories: default_categories(),
            },
            templates: vec![Template {
                id: "reguler".into(),
                name: "Reguler".into(),
                bells: Vec::new(),
            }],
        }
    }
}

pub struct Store {
    path: PathBuf,
    data: Mutex<AppData>,
}

impl Store {
    pub fn open(path: PathBuf) -> io::Result<Self> {
        let data = load(&path)?;
        Ok(Self {
            path,
            data: Mutex::new(data),
        })
    }

    pub fn get(&self) -> AppData {
        self.data.lock().unwrap().clone()
    }

    pub fn save(&self, data: AppData) -> io::Result<()> {
        // Lock held across the write so two saves can't land out of order.
        let mut current = self.data.lock().unwrap();
        write_atomic(&self.path, &data)?;
        *current = data;
        Ok(())
    }
}

/// Missing file = first run → defaults. Unreadable JSON is moved aside to
/// `data.corrupt-<unix time>.json` (each one kept) and the app starts with defaults.
/// Any other read error (e.g. file locked) is returned so we never replace
/// real data with defaults by mistake.
fn load(path: &Path) -> io::Result<AppData> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(AppData::default()),
        Err(e) => return Err(e),
    };
    match serde_json::from_slice(&bytes) {
        Ok(data) => Ok(data),
        Err(e) => {
            let secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_secs());
            let backup = path.with_extension(format!("corrupt-{secs}.json"));
            crate::log(&format!("data file unreadable ({e}), moved to {}", backup.display()));
            fs::rename(path, backup)?;
            Ok(AppData::default())
        }
    }
}

/// Write to a temp file, flush to disk, then rename over the real file, so a
/// power cut leaves either the old or the new file, never a half-written one.
fn write_atomic(path: &Path, data: &AppData) -> io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("json.tmp");
    let mut file = fs::File::create(&tmp)?;
    file.write_all(&serde_json::to_vec_pretty(data)?)?;
    file.sync_all()?;
    fs::rename(&tmp, path)
}

#[tauri::command]
pub fn get_data(store: State<Store>) -> AppData {
    store.get()
}

/// Async: the flush to disk must not freeze the window.
#[tauri::command]
pub async fn save_data(store: State<'_, Store>, data: AppData) -> Result<(), String> {
    store.save(data).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("bel-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn missing_file_gives_defaults() {
        let path = temp_dir("missing").join(DATA_FILE);
        assert_eq!(Store::open(path).unwrap().get(), AppData::default());
    }

    #[test]
    fn save_then_reopen_round_trips() {
        let path = temp_dir("roundtrip").join(DATA_FILE);
        let mut data = AppData::default();
        data.templates[0].bells.push(Bell {
            id: "b1".into(),
            time: "07:00".into(),
            label: "Masuk".into(),
            sound_file_name: "bel.mp3".into(),
            days: vec![1, 2, 3, 4, 5],
            category: "masuk".into(),
        });
        Store::open(path.clone()).unwrap().save(data.clone()).unwrap();
        assert_eq!(Store::open(path.clone()).unwrap().get(), data);
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn reads_camel_case_json_from_ui() {
        let json = r#"{"settings":{"audioOutputName":"","activeTemplateId":"t","quickBells":[]},
            "templates":[{"id":"t","name":"Jumat","bells":[{"id":"b","time":"11:30",
            "label":"Jumatan","soundFileName":"x.wav","days":[5]}]}]}"#;
        let data: AppData = serde_json::from_str(json).unwrap();
        assert_eq!(data.templates[0].bells[0].sound_file_name, "x.wav");
        // Files written before `category` existed still load, with the default.
        assert_eq!(data.templates[0].bells[0].category, "masuk");
        // …and get the four original bell types.
        assert_eq!(data.settings.categories.len(), 4);
        assert_eq!(data.settings.categories[0].id, "masuk");
    }

    #[test]
    fn corrupt_file_is_kept_aside() {
        let path = temp_dir("corrupt").join(DATA_FILE);
        fs::write(&path, b"{\"settings\": {").unwrap();
        assert_eq!(Store::open(path.clone()).unwrap().get(), AppData::default());
        let backups = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().starts_with("data.corrupt-"))
            .count();
        assert_eq!(backups, 1);
    }
}
