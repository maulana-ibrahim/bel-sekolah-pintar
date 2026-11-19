//! Sound playback on a dedicated thread (audio streams can't move between
//! threads on every platform). One sound at a time: a new play replaces the
//! current one.

use rodio::cpal::traits::HostTrait;
use rodio::{DeviceSinkBuilder, MixerDeviceSink, Player};
use std::{
    fs::File,
    io::BufReader,
    path::PathBuf,
    panic::{catch_unwind, AssertUnwindSafe},
    sync::mpsc::{channel, Sender},
    thread,
    time::Duration,
};

enum Cmd {
    Play {
        path: PathBuf,
        device: String,
        done: Sender<Result<(), String>>,
    },
    Stop,
}

pub struct Audio(Sender<Cmd>);

impl Audio {
    pub fn spawn() -> Self {
        let (tx, rx) = channel::<Cmd>();
        thread::spawn(move || {
            // Never read: holding it keeps the sound playing, dropping it stops it.
            let mut _playing: Option<(MixerDeviceSink, Player)> = None;
            for cmd in rx {
                _playing = None;
                if let Cmd::Play { path, device, done } = cmd {
                    // A panic inside cpal/rodio (bad file, flaky driver) must not
                    // kill this thread, or no bell could ever ring again.
                    let result = catch_unwind(AssertUnwindSafe(|| start(&path, &device)))
                        .unwrap_or_else(|_| Err("Pemutar audio gagal (file rusak atau driver bermasalah).".into()))
                        .map(|p| _playing = Some(p));
                    let _ = done.send(result);
                }
            }
        });
        Self(tx)
    }

    /// Plays `path` on the output device named `device` ("" = system default)
    /// and returns once playback has started or failed.
    pub fn play(&self, path: PathBuf, device: String) -> Result<(), String> {
        let (done, result) = channel();
        self.0
            .send(Cmd::Play { path, device, done })
            .map_err(|_| "audio thread stopped".to_string())?;
        // A stalled driver must not block the scheduler forever.
        result
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| "Perangkat audio tidak merespons.".to_string())?
    }

    pub fn stop(&self) {
        let _ = self.0.send(Cmd::Stop);
    }
}

fn start(path: &PathBuf, device: &str) -> Result<(MixerDeviceSink, Player), String> {
    // Chosen speaker unplugged or renamed → ring on the default one rather than not at all.
    let builder = match find_device(device) {
        Some(d) => DeviceSinkBuilder::from_device(d),
        None => DeviceSinkBuilder::from_default_device(),
    }
    .map_err(|e| format!("Perangkat audio tidak tersedia: {e}"))?;
    let mut sink = builder
        .open_sink_or_fallback()
        .map_err(|e| format!("Perangkat audio tidak bisa dibuka: {e}"))?;
    sink.log_on_drop(false);

    let file = File::open(path).map_err(|e| format!("File suara tidak bisa dibuka: {e}"))?;
    let player = rodio::play(sink.mixer(), BufReader::new(file))
        .map_err(|e| format!("File suara tidak bisa diputar: {e}"))?;
    Ok((sink, player))
}

fn find_device(name: &str) -> Option<rodio::Device> {
    if name.is_empty() {
        return None;
    }
    rodio::cpal::default_host()
        .output_devices()
        .ok()?
        .find(|d| d.to_string() == name)
}

/// Names of the output devices Windows currently offers.
pub fn output_device_names() -> Vec<String> {
    rodio::cpal::default_host()
        .output_devices()
        .map(|devices| devices.map(|d| d.to_string()).collect())
        .unwrap_or_default()
}
