//! Sound files live in `<AppData>/sounds`. Imports are copied in, so the
//! schedule keeps working when the original file is moved or deleted.

use std::{
    f32::consts::TAU,
    fs, io,
    path::{Path, PathBuf},
};

const EXTENSIONS: [&str; 2] = ["mp3", "wav"];
pub const DEFAULT_SOUND: &str = "Bel Default.wav";

pub struct SoundsDir(pub PathBuf);

/// One stored sound as the Sound Gallery shows it.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundInfo {
    pub name: String,
    pub size_bytes: u64,
    /// None when the file's header doesn't say (some MP3s).
    pub duration_secs: Option<f32>,
}

impl SoundsDir {
    /// Creates the folder on first run and puts a default bell in it.
    pub fn open(dir: PathBuf) -> io::Result<Self> {
        if !dir.exists() {
            fs::create_dir_all(&dir)?;
            fs::write(dir.join(DEFAULT_SOUND), default_bell_wav())?;
        }
        Ok(Self(dir))
    }

    pub fn list(&self) -> io::Result<Vec<String>> {
        let mut names: Vec<String> = fs::read_dir(&self.0)?
            .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
            .filter(|name| has_sound_extension(name))
            .collect();
        names.sort_by_key(|n| n.to_lowercase());
        Ok(names)
    }

    pub fn list_info(&self) -> io::Result<Vec<SoundInfo>> {
        Ok(self
            .list()?
            .into_iter()
            .filter_map(|name| {
                let path = self.0.join(&name);
                let size_bytes = fs::metadata(&path).ok()?.len();
                let duration_secs = fs::File::open(&path)
                    .ok()
                    .and_then(|f| rodio::Decoder::try_from(f).ok())
                    .and_then(|d| rodio::Source::total_duration(&d))
                    .map(|d| d.as_secs_f32());
                Some(SoundInfo { name, size_bytes, duration_secs })
            })
            .collect())
    }

    /// Copies `source` in and returns the stored file name ("name-2.mp3" if taken).
    pub fn import(&self, source: &Path) -> Result<String, String> {
        let name = source
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| has_sound_extension(n))
            .ok_or("Hanya file .mp3 atau .wav yang didukung.")?;
        let stored = unique_name(name, |n| self.0.join(n).exists());
        fs::copy(source, self.0.join(&stored)).map_err(|e| format!("Gagal menyalin file: {e}"))?;
        Ok(stored)
    }

    pub fn delete(&self, name: &str) -> Result<(), String> {
        fs::remove_file(self.path(name)?).map_err(|e| format!("Gagal menghapus file: {e}"))
    }

    /// Full path of a stored sound. Rejects anything that isn't a plain file
    /// name, so the UI can never reach files outside the sounds folder.
    pub fn path(&self, name: &str) -> Result<PathBuf, String> {
        if Path::new(name).file_name().and_then(|n| n.to_str()) != Some(name) {
            return Err("Nama file suara tidak valid.".into());
        }
        Ok(self.0.join(name))
    }
}

fn has_sound_extension(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| EXTENSIONS.contains(&e.to_lowercase().as_str()))
}

fn unique_name(name: &str, taken: impl Fn(&str) -> bool) -> String {
    if !taken(name) {
        return name.to_string();
    }
    let path = Path::new(name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(name);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    (2..)
        .map(|i| format!("{stem}-{i}.{ext}"))
        .find(|n| !taken(n))
        .unwrap()
}

/// Two-tone "ding-dong" chime, played twice: 16-bit mono PCM WAV.
fn default_bell_wav() -> Vec<u8> {
    const RATE: u32 = 44_100;
    let note = |freq: f32, secs: f32| {
        (0..(RATE as f32 * secs) as usize).map(move |i| {
            let t = i as f32 / RATE as f32;
            // Fundamental + a bell-like overtone, fading out.
            let wave = (TAU * freq * t).sin() + 0.4 * (TAU * freq * 2.76 * t).sin();
            wave * (-3.0 * t).exp() * 0.45
        })
    };
    let samples: Vec<i16> = (0..2)
        .flat_map(|_| note(659.25, 0.9).chain(note(523.25, 1.4)))
        .map(|s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect();

    let data_len = samples.len() as u32 * 2;
    let mut wav = Vec::with_capacity(44 + data_len as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes()); // fmt chunk size
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // mono
    wav.extend_from_slice(&RATE.to_le_bytes());
    wav.extend_from_slice(&(RATE * 2).to_le_bytes()); // byte rate
    wav.extend_from_slice(&2u16.to_le_bytes()); // block align
    wav.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for s in samples {
        wav.extend_from_slice(&s.to_le_bytes());
    }
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unique_name_adds_a_suffix_when_taken() {
        let taken = ["bel.mp3", "bel-2.mp3"];
        assert_eq!(unique_name("baru.mp3", |n| taken.contains(&n)), "baru.mp3");
        assert_eq!(unique_name("bel.mp3", |n| taken.contains(&n)), "bel-3.mp3");
    }

    #[test]
    fn only_plain_file_names_resolve() {
        let dir = SoundsDir(PathBuf::from("sounds"));
        assert!(dir.path("bel.mp3").is_ok());
        assert!(dir.path("../data.json").is_err());
        assert!(dir.path("a/b.mp3").is_err());
        assert!(dir.path("").is_err());
    }

    #[test]
    fn list_info_reports_size_and_duration() {
        let dir = std::env::temp_dir().join(format!("bel-sounds-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let sounds = SoundsDir::open(dir.clone()).unwrap();
        let info = sounds.list_info().unwrap();
        assert_eq!(info.len(), 1);
        assert_eq!(info[0].name, DEFAULT_SOUND);
        assert!(info[0].size_bytes > 0);
        assert!(info[0].duration_secs.is_some_and(|s| (4.0..5.0).contains(&s)));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn default_bell_is_a_playable_wav() {
        let wav = default_bell_wav();
        assert_eq!(&wav[..4], b"RIFF");
        let source = rodio::Decoder::try_from(io::Cursor::new(wav)).unwrap();
        let secs = rodio::Source::total_duration(&source).unwrap().as_secs_f32();
        assert!((4.0..5.0).contains(&secs), "duration {secs}");
    }
}
