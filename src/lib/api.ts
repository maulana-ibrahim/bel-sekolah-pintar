// Calls into the Rust backend (src-tauri/src/lib.rs). Errors arrive as
// rejected promises carrying a user-facing message.
import { invoke } from "@tauri-apps/api/core";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import type { AppData } from "./data";

// Data file (written safely by src-tauri/src/data.rs).
export const loadData = () => invoke<AppData>("get_data");
export const saveData = (data: AppData) => invoke<void>("save_data", { data });

// Sounds stored in <AppData>/sounds.
export interface SoundInfo {
  name: string;
  sizeBytes: number;
  /** null when the file's header doesn't say. */
  durationSecs: number | null;
}
/** Created by the app on first run (src-tauri/src/sounds.rs). */
export const DEFAULT_SOUND = "Bel Default.wav";
export const listSounds = () => invoke<SoundInfo[]>("list_sounds");
export const deleteSound = (name: string) => invoke<void>("delete_sound", { name });

/** Opens the file picker and copies the chosen file in. Resolves to the stored name, or null if cancelled. */
export async function importSound(): Promise<string | null> {
  const path = await open({ filters: [{ name: "Audio", extensions: ["mp3", "wav"] }] });
  return path ? invoke<string>("import_sound", { path }) : null;
}

// Playback on the speaker chosen in Settings.
export const playSound = (name: string) => invoke<void>("play_sound", { name });
export const stopSound = () => invoke<void>("stop_sound");
export const listOutputDevices = () => invoke<string[]>("list_output_devices");

/** Native Windows yes/no box for destructive actions. */
export const confirmDelete = (message: string) =>
  confirm(message, { title: "Hapus", kind: "warning", okLabel: "Hapus", cancelLabel: "Batal" });
