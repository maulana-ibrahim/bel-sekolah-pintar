// App data shape (mirrors src-tauri/src/data.rs) and the pure edit operations
// the UI uses. Every operation returns a new AppData or throws an Error whose
// message is shown to the user as-is.

/** 1 = Senin … 7 = Minggu (ISO weekday, same numbering the Rust scheduler uses). */
export type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;

/** User-editable bell type; bells point to it by id. Color is "#rrggbb". */
export interface Category {
  id: string;
  name: string;
  color: string;
}

export type QuickBellColor = "blue" | "sun" | "green" | "coral";
/** Icon keys; mapped to Lucide icons in src/components/bell/icons.tsx. */
export type QuickBellIcon = "siren" | "flag" | "door" | "bell" | "megaphone" | "music";

export interface Bell {
  id: string;
  /** "HH:mm", 24-hour. */
  time: string;
  label: string;
  soundFileName: string;
  days: Day[];
  /** Category id. */
  category: string;
}

export interface Template {
  id: string;
  name: string;
  /** Kept sorted by time. */
  bells: Bell[];
}

/** Manual bell button on the dashboard. */
export interface QuickBell {
  id: string;
  label: string;
  soundFileName: string;
  color: QuickBellColor;
  icon: QuickBellIcon;
}

export interface Settings {
  /** Output device name; "" = system default. */
  audioOutputName: string;
  activeTemplateId: string;
  quickBells: QuickBell[];
  categories: Category[];
}

export interface AppData {
  settings: Settings;
  templates: Template[];
}

export const newId = () => crypto.randomUUID();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(message: string): never {
  throw new Error(message);
}

function required(value: string, what: string) {
  const v = value.trim();
  if (!v) fail(`${what} tidak boleh kosong.`);
  return v;
}

function templateName(data: AppData, name: string, exceptId?: string) {
  const n = required(name, "Nama template");
  const taken = data.templates.some(
    (t) => t.id !== exceptId && t.name.toLowerCase() === n.toLowerCase(),
  );
  if (taken) fail(`Template "${n}" sudah ada.`);
  return n;
}

function editTemplate(data: AppData, id: string, edit: (t: Template) => Template): AppData {
  if (!data.templates.some((t) => t.id === id)) fail("Template tidak ditemukan.");
  return { ...data, templates: data.templates.map((t) => (t.id === id ? edit(t) : t)) };
}

// ── Templates ────────────────────────────────────────────────────────────

/** Appends a new template at the end of the list, empty or with copies of
 *  another template's bells (`copyFromId`). */
export function addTemplate(data: AppData, name: string, copyFromId?: string): AppData {
  const source = data.templates.find((t) => t.id === copyFromId);
  if (copyFromId && !source) fail("Template sumber tidak ditemukan.");
  const bells = (source?.bells ?? []).map((b) => ({ ...b, id: newId() }));
  const t: Template = { id: newId(), name: templateName(data, name), bells };
  return { ...data, templates: [...data.templates, t] };
}

export function renameTemplate(data: AppData, id: string, name: string): AppData {
  const n = templateName(data, name, id);
  return editTemplate(data, id, (t) => ({ ...t, name: n }));
}

export function deleteTemplate(data: AppData, id: string): AppData {
  if (data.settings.activeTemplateId === id)
    fail("Template aktif tidak bisa dihapus. Aktifkan template lain dulu.");
  return { ...data, templates: data.templates.filter((t) => t.id !== id) };
}

export function setActiveTemplate(data: AppData, id: string): AppData {
  if (!data.templates.some((t) => t.id === id)) fail("Template tidak ditemukan.");
  return { ...data, settings: { ...data.settings, activeTemplateId: id } };
}

// ── Bells ────────────────────────────────────────────────────────────────

/** Adds the bell, or replaces the one with the same id. */
export function saveBell(data: AppData, templateId: string, bell: Bell): AppData {
  if (!TIME_RE.test(bell.time)) fail("Format jam harus HH:mm (contoh 07:00).");
  const label = required(bell.label, "Label");
  if (!bell.soundFileName) fail("Pilih suara bel.");
  const days = [...new Set(bell.days)].filter((d) => d >= 1 && d <= 7).sort() as Day[];
  if (days.length === 0) fail("Pilih minimal satu hari.");
  if (!data.settings.categories.some((c) => c.id === bell.category)) fail("Pilih jenis bel.");
  const clean: Bell = { ...bell, label, days };

  return editTemplate(data, templateId, (t) => {
    for (const other of t.bells) {
      if (other.id === bell.id || other.time !== bell.time) continue;
      const day = days.find((d) => other.days.includes(d));
      if (day)
        fail(`Bentrok: sudah ada bel "${other.label}" jam ${other.time} hari ${DAY_NAMES[day - 1]}.`);
    }
    const bells = [...t.bells.filter((b) => b.id !== bell.id), clean];
    bells.sort((a, b) => a.time.localeCompare(b.time));
    return { ...t, bells };
  });
}

export function deleteBell(data: AppData, templateId: string, bellId: string): AppData {
  return editTemplate(data, templateId, (t) => ({
    ...t,
    bells: t.bells.filter((b) => b.id !== bellId),
  }));
}

// ── Settings & quick bells ───────────────────────────────────────────────

export function setAudioOutput(data: AppData, name: string): AppData {
  return { ...data, settings: { ...data.settings, audioOutputName: name } };
}

/** Adds the quick bell, or replaces the one with the same id. */
export function saveQuickBell(data: AppData, qb: QuickBell): AppData {
  const label = required(qb.label, "Label");
  if (!qb.soundFileName) fail("Pilih suara bel.");
  const clean = { ...qb, label };
  const list = data.settings.quickBells;
  // Edit in place so the dashboard button order stays put; new ones go last.
  const quickBells = list.some((q) => q.id === qb.id)
    ? list.map((q) => (q.id === qb.id ? clean : q))
    : [...list, clean];
  return { ...data, settings: { ...data.settings, quickBells } };
}

export function deleteQuickBell(data: AppData, id: string): AppData {
  const quickBells = data.settings.quickBells.filter((q) => q.id !== id);
  return { ...data, settings: { ...data.settings, quickBells } };
}

// ── Bell types (categories) ─────────────────────────────────────────────

const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Shown for a bell whose type was removed outside the app. */
const UNKNOWN_CATEGORY: Category = { id: "", name: "Tanpa jenis", color: "#9aa3b8" };

export const categoryOf = (data: AppData, id: string) =>
  data.settings.categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY;

/** Every bell of this type, with its template's name, so the user can find and change them. */
export function categoryUsage(data: AppData, id: string) {
  return data.templates.flatMap((t) =>
    t.bells.filter((b) => b.category === id).map((bell) => ({ templateName: t.name, bell })),
  );
}

/** Adds the type, or replaces the one with the same id (keeping its place). */
export function saveCategory(data: AppData, cat: Category): AppData {
  const name = required(cat.name, "Nama jenis");
  if (!COLOR_RE.test(cat.color)) fail("Pilih warna.");
  const list = data.settings.categories;
  if (list.some((c) => c.id !== cat.id && c.name.toLowerCase() === name.toLowerCase()))
    fail(`Jenis "${name}" sudah ada.`);
  // Same color on two types would make the dots ambiguous.
  const sameColor = list.find((c) => c.id !== cat.id && c.color.toLowerCase() === cat.color.toLowerCase());
  if (sameColor) fail(`Warna ini sudah dipakai jenis "${sameColor.name}". Pilih warna lain.`);
  const clean = { ...cat, name, color: cat.color.toLowerCase() };
  const categories = list.some((c) => c.id === cat.id)
    ? list.map((c) => (c.id === cat.id ? clean : c))
    : [...list, clean];
  return { ...data, settings: { ...data.settings, categories } };
}

export function deleteCategory(data: AppData, id: string): AppData {
  const used = categoryUsage(data, id).length;
  if (used) fail(`Jenis ini masih dipakai ${used} bel. Ganti jenis bel-bel itu dulu di menu Jadwal.`);
  const categories = data.settings.categories.filter((c) => c.id !== id);
  if (categories.length === 0) fail("Minimal harus ada satu jenis bel.");
  return { ...data, settings: { ...data.settings, categories } };
}

// ── Sounds ───────────────────────────────────────────────────────────────

/** How many template bells and quick bells play this file (> 0 blocks deleting it). */
export function soundUsage(data: AppData, soundFileName: string): number {
  const bells = data.templates.flatMap((t) => t.bells);
  return [...bells, ...data.settings.quickBells].filter((b) => b.soundFileName === soundFileName).length;
}

export const isSoundUsed = (data: AppData, soundFileName: string) => soundUsage(data, soundFileName) > 0;

// ── Today's schedule (dashboard) ─────────────────────────────────────────

/** JS Date → 1 = Senin … 7 = Minggu. */
export const isoWeekday = (d: Date) => (((d.getDay() + 6) % 7) + 1) as Day;

/** "HH:mm" of a Date, same format bells use. */
export const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

export const activeTemplate = (data: AppData) =>
  data.templates.find((t) => t.id === data.settings.activeTemplateId);

/** Bells of the active template that ring on `now`'s weekday, by time.
 *  A bell counts as done from its own minute on, since the scheduler rings
 *  it at the start of that minute. */
export function todaySchedule(data: AppData, now: Date) {
  const day = isoWeekday(now);
  const time = hhmm(now);
  const bells = (activeTemplate(data)?.bells ?? []).filter((b) => b.days.includes(day));
  const next = bells.find((b) => b.time > time);
  const doneCount = bells.filter((b) => b.time <= time).length;
  return { bells, next, doneCount };
}

/** Seconds from `now` until bell time "HH:mm" today. */
export function secondsUntil(time: string, now: Date) {
  const [h, m] = time.split(":").map(Number);
  return h * 3600 + m * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
}

/** 213 → "03:33", 4980 → "1:23:00". */
export function formatCountdown(seconds: number) {
  const s = Math.max(0, seconds);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const mmss = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return h ? `${h}:${mmss}` : mmss;
}
