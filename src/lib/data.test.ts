// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addTemplate,
  categoryUsage,
  deleteCategory,
  saveCategory,
  deleteBell,
  deleteTemplate,
  isSoundUsed,
  renameTemplate,
  saveBell,
  saveQuickBell,
  setActiveTemplate,
  secondsUntil,
  formatCountdown,
  todaySchedule,
  type AppData,
  type Bell,
} from "./data.ts";

const base = (): AppData => ({
  settings: {
    audioOutputName: "",
    activeTemplateId: "reg",
    quickBells: [],
    categories: [
      { id: "masuk", name: "Masuk", color: "#2f6bff" },
      { id: "pulang", name: "Pulang", color: "#ff6b4a" },
    ],
  },
  templates: [{ id: "reg", name: "Reguler", bells: [] }],
});

const bell = (over: Partial<Bell> = {}): Bell => ({
  id: "b1",
  time: "07:00",
  label: "Masuk",
  soundFileName: "bel.mp3",
  days: [1, 2, 3, 4, 5],
  category: "masuk",
  ...over,
});

test("template names are required and unique (case-insensitive)", () => {
  const d = addTemplate(base(), "  Jumat ");
  assert.equal(d.templates[1].name, "Jumat");
  assert.throws(() => addTemplate(d, "jumat"), /sudah ada/);
  assert.throws(() => addTemplate(d, "   "), /tidak boleh kosong/);
  assert.equal(renameTemplate(d, "reg", "Reguler").templates[0].name, "Reguler");
});

test("active template cannot be deleted", () => {
  const d = addTemplate(base(), "Ujian");
  assert.throws(() => deleteTemplate(d, "reg"), /Template aktif/);
  const ujian = d.templates[1].id;
  assert.equal(deleteTemplate(setActiveTemplate(d, ujian), "reg").templates.length, 1);
});

test("same time on an overlapping day conflicts; other days or edits do not", () => {
  const d = saveBell(base(), "reg", bell());
  assert.throws(
    () => saveBell(d, "reg", bell({ id: "b2", days: [5, 6] })),
    /Bentrok.*Jumat/,
  );
  // same time, no shared day → ok
  assert.equal(saveBell(d, "reg", bell({ id: "b2", days: [6] })).templates[0].bells.length, 2);
  // editing the bell itself is not a conflict
  assert.equal(saveBell(d, "reg", bell({ label: "Masuk Pagi" })).templates[0].bells[0].label, "Masuk Pagi");
});

test("bells are validated, cleaned and kept sorted by time", () => {
  assert.throws(() => saveBell(base(), "reg", bell({ time: "7:00" })), /HH:mm/);
  assert.throws(() => saveBell(base(), "reg", bell({ time: "24:00" })), /HH:mm/);
  assert.throws(() => saveBell(base(), "reg", bell({ days: [] })), /minimal satu hari/);
  assert.throws(() => saveBell(base(), "reg", bell({ soundFileName: "" })), /suara/);
  assert.throws(() => saveBell(base(), "nope", bell()), /tidak ditemukan/);

  let d = saveBell(base(), "reg", bell({ id: "late", time: "12:00", days: [3, 1, 3] }));
  d = saveBell(d, "reg", bell({ id: "early", time: "06:45" }));
  assert.deepEqual(d.templates[0].bells.map((b) => b.id), ["early", "late"]);
  assert.deepEqual(d.templates[0].bells[1].days, [1, 3]);
  assert.equal(deleteBell(d, "reg", "early").templates[0].bells.length, 1);
});

test("a sound is in use when a bell or quick bell plays it", () => {
  let d = saveBell(base(), "reg", bell({ soundFileName: "a.mp3" }));
  d = saveQuickBell(d, { id: "q", label: "Darurat", soundFileName: "b.wav", color: "coral", icon: "siren" });
  assert.ok(isSoundUsed(d, "a.mp3"));
  assert.ok(isSoundUsed(d, "b.wav"));
  assert.ok(!isSoundUsed(d, "c.mp3"));
});

test("editing a quick bell keeps its position", () => {
  const qb = (id: string, label: string) =>
    ({ id, label, soundFileName: "a.mp3", color: "blue", icon: "bell" }) as const;
  let d = saveQuickBell(base(), qb("x", "Darurat"));
  d = saveQuickBell(d, qb("y", "Upacara"));
  d = saveQuickBell(d, qb("x", "Darurat Baru"));
  assert.deepEqual(d.settings.quickBells.map((q) => q.label), ["Darurat Baru", "Upacara"]);
});

test("today's schedule: day filter, done from its own minute, next bell", () => {
  let d = base();
  d = saveBell(d, "reg", bell({ id: "a", time: "07:00", days: [4] }));
  d = saveBell(d, "reg", bell({ id: "b", time: "09:45", days: [4] }));
  d = saveBell(d, "reg", bell({ id: "c", time: "10:00", days: [5] }));
  const thu = (t: string) => new Date(`2026-11-19T${t}`); // a Thursday (day 4)
  let s = todaySchedule(d, thu("09:44:59"));
  assert.deepEqual(s.bells.map((b) => b.id), ["a", "b"]);
  assert.equal(s.next?.id, "b");
  assert.equal(s.doneCount, 1);
  s = todaySchedule(d, thu("09:45:10"));
  assert.equal(s.next, undefined);
  assert.equal(s.doneCount, 2);
  assert.equal(secondsUntil("09:45", thu("09:41:27")), 213);
});

test("countdown format", () => {
  assert.equal(formatCountdown(213), "03:33");
  assert.equal(formatCountdown(4980), "1:23:00");
  assert.equal(formatCountdown(-5), "00:00");
});

test("a new template can copy another template's bells with fresh ids", () => {
  const d0 = saveBell(base(), "reg", bell());
  const d = addTemplate(d0, "Ujian", "reg");
  const copy = d.templates[1].bells;
  assert.equal(copy.length, 1);
  assert.equal(copy[0].time, "07:00");
  assert.notEqual(copy[0].id, "b1");
});

test("copying from a template that no longer exists is refused", () => {
  assert.throws(() => addTemplate(base(), "Ujian", "hilang"), /tidak ditemukan/);
});

test("bell types: unique names, valid colors, edit in place", () => {
  let d = saveCategory(base(), { id: "upacara", name: " Upacara ", color: "#8B5CF6" });
  assert.deepEqual(d.settings.categories.at(-1), { id: "upacara", name: "Upacara", color: "#8b5cf6" });
  assert.throws(() => saveCategory(d, { id: "x", name: "masuk", color: "#000000" }), /sudah ada/);
  assert.throws(() => saveCategory(d, { id: "x", name: "Baru", color: "merah" }), /warna/);
  d = saveCategory(d, { id: "masuk", name: "Bel Masuk", color: "#2f6bff" });
  assert.equal(d.settings.categories[0].name, "Bel Masuk");
  assert.throws(() => saveBell(d, "reg", bell({ category: "hilang" })), /jenis/);
});

test("a bell type in use can't be deleted, and its bells are listed", () => {
  const d = saveBell(base(), "reg", bell({ category: "pulang" }));
  assert.deepEqual(categoryUsage(d, "pulang").map((u) => `${u.templateName} ${u.bell.time}`), ["Reguler 07:00"]);
  assert.throws(() => deleteCategory(d, "pulang"), /masih dipakai 1 bel/);
  const d2 = deleteCategory(d, "masuk");
  assert.deepEqual(d2.settings.categories.map((c) => c.id), ["pulang"]);
  assert.throws(() => deleteCategory(deleteBell(d2, "reg", "b1"), "pulang"), /Minimal/);
});

test("two bell types can't share a color (case-insensitive), but a type keeps its own", () => {
  assert.throws(
    () => saveCategory(base(), { id: "x", name: "Upacara", color: "#2F6BFF" }),
    /sudah dipakai jenis "Masuk"/,
  );
  // Saving "Masuk" again with its own color is fine.
  saveCategory(base(), { id: "masuk", name: "Masuk", color: "#2f6bff" });
});
