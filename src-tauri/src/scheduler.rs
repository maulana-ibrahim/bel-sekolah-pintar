//! Rings the active template's bells. Checks the clock every second and fires
//! each minute at most once, so a skipped tick can't miss a bell and a slow
//! tick can't ring it twice. Bells whose minute passed while the PC slept are
//! skipped, never rung late.

use crate::data::{AppData, Bell};
use chrono::{Datelike, Local};
use std::{thread, time::Duration};
use tauri::{AppHandle, Manager};

pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        // Start from the current minute: a restart at 07:00:30 must not re-ring 07:00.
        let mut last = Local::now().format("%F %H:%M").to_string();
        let mut prev_tick = Local::now();
        loop {
            thread::sleep(Duration::from_secs(1));
            let now = Local::now();
            let minute = now.format("%F %H:%M").to_string();
            // Woke from sleep (or the clock jumped ahead): treat this minute as
            // already handled, so a bell is never rung late.
            let gap = now - prev_tick;
            prev_tick = now;
            if gap > chrono::TimeDelta::seconds(5) {
                last = minute;
                continue;
            }
            if minute == last {
                continue;
            }
            // ponytail: a clock set back (e.g. time sync) can repeat a minute and
            // re-ring it; keep a per-day set of fired bells if that shows up.
            last = minute;

            let data = app.state::<crate::data::Store>().get();
            let weekday = now.weekday().number_from_monday() as u8;
            if let Some(bell) = due_bell(&data, weekday, &now.format("%H:%M").to_string())
                && let Err(e) = crate::play_sound_file(&app, &bell.sound_file_name)
            {
                crate::log(&format!("bel {} \"{}\" gagal: {e}", bell.time, bell.label));
            }
        }
    });
}

/// The active template's bell for this weekday (1 = Monday) and "HH:mm", if any.
pub fn due_bell<'a>(data: &'a AppData, weekday: u8, time: &str) -> Option<&'a Bell> {
    data.templates
        .iter()
        .find(|t| t.id == data.settings.active_template_id)?
        .bells
        .iter()
        .find(|b| b.time == time && b.days.contains(&weekday))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::Template;

    #[test]
    fn only_the_active_template_on_matching_day_and_minute_rings() {
        let bell = |time: &str, days: Vec<u8>| Bell {
            id: time.into(),
            time: time.into(),
            label: "x".into(),
            sound_file_name: "bel.wav".into(),
            days,
            category: "masuk".into(),
        };
        let mut data = AppData::default();
        data.templates[0].bells = vec![bell("07:00", vec![1, 2, 3, 4, 5]), bell("11:30", vec![5])];
        data.templates.push(Template {
            id: "ujian".into(),
            name: "Ujian".into(),
            bells: vec![bell("08:00", vec![1])],
        });

        assert_eq!(due_bell(&data, 1, "07:00").unwrap().time, "07:00");
        assert!(due_bell(&data, 6, "07:00").is_none()); // Saturday
        assert!(due_bell(&data, 1, "07:01").is_none());
        assert!(due_bell(&data, 4, "11:30").is_none()); // Thursday
        assert_eq!(due_bell(&data, 5, "11:30").unwrap().time, "11:30");
        assert!(due_bell(&data, 1, "08:00").is_none()); // inactive template
    }
}
