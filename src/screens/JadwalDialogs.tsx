// Dialogs of the Jadwal screen (designs: "D2 Dialog Tambah Bel" and
// "D2 Dialog Template Baru" on the Wonder canvas). Each form keeps its own
// state and shows validation errors inline; the dialog closes only after a
// successful save.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryDot, OverflowText } from "@/components/bell-ui";
import { CategoryForm } from "@/components/CategoryForm";
import * as api from "@/lib/api";
import { DAY_NAMES, newId, type AppData, type Bell, type Category, type Day } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ErrorNote, Field, FormDialog, TimeInput, message } from "@/components/form";

// ── Bell ─────────────────────────────────────────────────────────────────

const DAY_PRESETS: { label: string; days: Day[] }[] = [
  { label: "Sen–Jum", days: [1, 2, 3, 4, 5] },
  { label: "Sen–Sab", days: [1, 2, 3, 4, 5, 6] },
  { label: "Semua", days: [1, 2, 3, 4, 5, 6, 7] },
];

export function BellDialog({
  open,
  bell,
  templateName,
  data,
  onClose,
  onSave,
  onAddCategory,
}: {
  open: boolean;
  /** Bell being edited; undefined = new bell. */
  bell?: Bell;
  templateName: string;
  data: AppData;
  onClose: () => void;
  /** Throws with a user-facing message when the bell is refused (e.g. a clash). */
  onSave: (bell: Bell) => Promise<void>;
  /** "+ Jenis baru" inside the form. Throws when refused (e.g. duplicate name/color). */
  onAddCategory: (c: Category) => Promise<void>;
}) {
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={bell ? "Ubah bel" : "Tambah bel"}
      subtitle={`Template ${templateName}`}
      className="sm:max-w-[480px]"
    >
      <BellForm bell={bell} data={data} onClose={onClose} onSave={onSave} onAddCategory={onAddCategory} />
    </FormDialog>
  );
}

function BellForm({
  bell,
  data,
  onClose,
  onSave,
  onAddCategory,
}: {
  bell?: Bell;
  data: AppData;
  onClose: () => void;
  onSave: (bell: Bell) => Promise<void>;
  onAddCategory: (c: Category) => Promise<void>;
}) {
  const categories = data.settings.categories;
  const [addingCategory, setAddingCategory] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Bell>(
    () => bell ?? { id: newId(), time: "", label: "", category: categories[0]?.id ?? "", days: [1, 2, 3, 4, 5], soundFileName: "" },
  );
  const [sounds, setSounds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Bell>) => setForm((f) => ({ ...f, ...patch }));
  const id = useId();

  // Keep the selected type visible inside its scroll box (on open, and when a
  // type made with "+ Jenis baru" lands at the end of the list).
  useEffect(() => {
    chipsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  }, [form.category, categories.length]);

  useEffect(() => {
    api.listSounds().then(
      (list) => {
        const names = list.map((s) => s.name);
        setSounds(names);
        // New bell: preselect the first sound so the common case is one click less.
        setForm((f) => (f.soundFileName ? f : { ...f, soundFileName: names[0] ?? "" }));
      },
      (e) => setError(message(e)),
    );
  }, []);

  const toggleDay = (d: Day) =>
    set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d] });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex gap-3">
        <div className="w-[130px]">
          <Field label="Jam" htmlFor={`${id}-time`}>
            <TimeInput id={`${id}-time`} autoFocus value={form.time} onChange={(time) => set({ time })} />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Label" htmlFor={`${id}-label`}>
            <Input id={`${id}-label`} required value={form.label} placeholder="Bel Masuk" onChange={(e) => set({ label: e.target.value })} />
          </Field>
        </div>
      </div>

      <Field
        label="Jenis bel"
        extra={
          <Button
            type="button"
            variant="dashed"
            size="sm"
            className="h-7 rounded-full border-2 px-2.5 text-xs"
            onClick={() => setAddingCategory(true)}
          >
            <Plus className="size-3.5" />
            Jenis baru
          </Button>
        }
      >
        {/* Chips size to their names and wrap; at most 3 rows show (3 × 40px
            + 2 gaps + padding), the rest scroll inside this box only. */}
        <div ref={chipsRef} className="-m-0.5 flex max-h-[140px] flex-wrap gap-2 overflow-y-auto p-0.5">
          {categories.map((c) => {
            const on = form.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ category: c.id })}
                // Selected: outlined and lightly tinted in the type's own color.
                style={on ? { borderColor: c.color, backgroundColor: `${c.color}24` } : undefined}
                className={cn(
                  "flex h-10 max-w-full min-w-0 items-center gap-2 rounded-lg border-2 px-3 text-sm",
                  on ? "font-extrabold" : "border-border font-bold hover:bg-muted",
                )}
              >
                <CategoryDot color={c.color} />
                <OverflowText text={c.name} />
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Hari"
        extra={
          <div className="flex gap-1.5">
            {DAY_PRESETS.map((p) => {
              const on = p.days.length === form.days.length && p.days.every((d) => form.days.includes(d));
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => set({ days: p.days })}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-extrabold",
                    on ? "bg-blue-soft text-blue" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((name, i) => {
            const day = (i + 1) as Day;
            const on = form.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={name}
                onClick={() => toggleDay(day)}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg text-[13px] font-extrabold",
                  on ? "bg-blue text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Suara" htmlFor={`${id}-sound`}>
        {sounds.length === 0 ? (
          <p className="text-[13px] font-semibold text-muted-foreground">
            Belum ada suara. Tambahkan dulu di Galeri Suara.
          </p>
        ) : (
          <div className="flex gap-2">
            <Select value={form.soundFileName} onValueChange={(v) => set({ soundFileName: v })}>
              <SelectTrigger id={`${id}-sound`} className="min-w-0 flex-1">
                <SelectValue placeholder="Pilih suara" />
              </SelectTrigger>
              <SelectContent>
                {sounds.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                {form.soundFileName && !sounds.includes(form.soundFileName) && (
                  <SelectItem value={form.soundFileName}>{form.soundFileName} (hilang)</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="soft"
              className="size-12 p-0"
              aria-label="Dengarkan"
              disabled={!form.soundFileName}
              onClick={() => api.playSound(form.soundFileName).catch((e) => setError(message(e)))}
            >
              <Play />
            </Button>
          </div>
        )}
      </Field>

      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          Simpan bel
        </Button>
      </DialogFooter>
    </form>

    {/* Second dialog on top: the same form as the Jenis Bel screen. Kept
        outside <form>: React events bubble through portals, so its submit
        would otherwise also submit the bell. */}
    <FormDialog
      open={addingCategory}
      onClose={() => setAddingCategory(false)}
      title="Jenis bel baru"
      className="sm:max-w-[440px]"
    >
      <CategoryForm
        data={data}
        onClose={() => setAddingCategory(false)}
        onSave={async (c) => {
          await onAddCategory(c);
          set({ category: c.id }); // select the type just made
        }}
        onDelete={async () => {}}
      />
    </FormDialog>
    </>
  );
}

// ── Template ─────────────────────────────────────────────────────────────

export type TemplateDialogState =
  | { mode: "new"; copyFromId?: string; name?: string }
  | { mode: "rename"; id: string; name: string };

export function TemplateDialog({
  state,
  data,
  onClose,
  onSubmit,
}: {
  state: TemplateDialogState | null;
  data: AppData;
  onClose: () => void;
  /** Throws with a user-facing message when refused (e.g. duplicate name). */
  onSubmit: (state: TemplateDialogState, name: string, copyFromId?: string) => Promise<void>;
}) {
  const title = state?.mode === "rename" ? "Ganti nama template" : "Template baru";
  return (
    <FormDialog open={!!state} onClose={onClose} title={title} className="sm:max-w-[420px]">
      {state && <TemplateForm state={state} data={data} onClose={onClose} onSubmit={onSubmit} />}
    </FormDialog>
  );
}

const EMPTY = "kosong";

function TemplateForm({
  state,
  data,
  onClose,
  onSubmit,
}: {
  state: TemplateDialogState;
  data: AppData;
  onClose: () => void;
  onSubmit: (state: TemplateDialogState, name: string, copyFromId?: string) => Promise<void>;
}) {
  const [name, setName] = useState(state.name ?? "");
  const [copyFrom, setCopyFrom] = useState(state.mode === "new" ? (state.copyFromId ?? EMPTY) : EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit(state, name, copyFrom === EMPTY ? undefined : copyFrom);
      onClose();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label="Nama template" htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} required autoFocus value={name} placeholder="Contoh: Ramadhan" onChange={(e) => setName(e.target.value)} />
      </Field>

      {state.mode === "new" && (
        <Field label="Isi awal" htmlFor={`${id}-copy`}>
          <Select value={copyFrom} onValueChange={setCopyFrom}>
            <SelectTrigger id={`${id}-copy`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>Kosong</SelectItem>
              {data.templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Salin dari “{t.name}” ({t.bells.length} bel)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {state.mode === "new" ? "Buat template" : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
