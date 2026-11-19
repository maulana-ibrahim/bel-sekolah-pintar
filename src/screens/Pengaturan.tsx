import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Info, Pencil, Play, Plus, Power, Trash2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IconTile, OverflowText, PageHeader, QUICK_ICONS, SOLID } from "@/components/bell-ui";
import * as api from "@/lib/api";
import {
  deleteQuickBell,
  newId,
  saveQuickBell,
  setAudioOutput,
  type AppData,
  type QuickBell,
  type QuickBellColor,
  type QuickBellIcon,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { ErrorNote, Field, FormDialog, message } from "@/components/form";

/** Select can't hold "", which is how the data stores "system default". */
const DEFAULT_DEVICE = "__default__";

export default function Pengaturan({
  data,
  save,
  apply,
  run,
}: {
  data: AppData;
  save: (edit: (d: AppData) => AppData) => Promise<AppData>;
  apply: (edit: (d: AppData) => AppData) => void;
  run: (p: Promise<unknown>) => void;
}) {
  const [devices, setDevices] = useState<string[]>([]);
  const [autoStart, setAutoStart] = useState<boolean | null>(null);
  const [version, setVersion] = useState("");
  const [quickDialog, setQuickDialog] = useState<{ bell?: QuickBell } | null>(null);
  const chosen = data.settings.audioOutputName;

  useEffect(() => {
    run(api.listOutputDevices().then(setDevices));
    run(isEnabled().then(setAutoStart));
    run(getVersion().then(setVersion));
  }, [run]);

  function toggleAutoStart(on: boolean) {
    setAutoStart(on);
    run(
      (on ? enable() : disable()).catch((e) => {
        setAutoStart(!on); // show the real state again
        throw e;
      }),
    );
  }

  /** Plays the first stored sound on the chosen speaker. */
  function testSound() {
    run(
      api.listSounds().then((list) => {
        if (!list.length) throw new Error("Belum ada suara. Tambahkan dulu di Galeri Suara.");
        return api.playSound(list[0].name);
      }),
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-7">
      <PageHeader title="Pengaturan" subtitle="Perubahan tersimpan otomatis." />

      <div className="flex flex-1 gap-[18px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
          {/* Output device */}
          <section className="flex flex-col gap-3.5 rounded-3xl border bg-card p-5">
            <CardHead
              icon={<IconTile icon={Volume2} color="blue" />}
              title="Output suara"
              desc="Pilih speaker atau sistem PA tujuan bel."
            />
            <Select
              value={chosen || DEFAULT_DEVICE}
              onValueChange={(v) => apply((d) => setAudioOutput(d, v === DEFAULT_DEVICE ? "" : v))}
            >
              <SelectTrigger aria-label="Output suara" className="w-full border-blue">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_DEVICE}>Speaker bawaan sistem</SelectItem>
                {devices.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
                {chosen && !devices.includes(chosen) && (
                  <SelectItem value={chosen}>{chosen} (tidak terhubung)</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between gap-3">
              <Button variant="soft" onClick={testSound}>
                <Play />
                Tes suara
              </Button>
              <span className="text-right text-[13px] font-semibold text-muted-foreground">
                Jika speaker dicabut, bel pindah ke speaker bawaan.
              </span>
            </div>
          </section>

          {/* Autostart */}
          <section className="flex items-center gap-3 rounded-3xl border bg-card p-5">
            <CardHead
              icon={<IconTile icon={Power} color="green" />}
              title="Jalan otomatis"
              desc="Mulai saat Windows login, langsung tersembunyi di tray."
            />
            <Switch
              className="ml-auto"
              aria-label="Jalan otomatis"
              checked={!!autoStart}
              disabled={autoStart === null}
              onCheckedChange={toggleAutoStart}
            />
          </section>

          <p className="flex items-start gap-2.5 rounded-xl bg-sun-soft px-4 py-3 text-[13px] leading-[1.45] font-semibold">
            <Info className="mt-0.5 size-4 shrink-0" />
            Bel hanya berbunyi saat PC menyala dan sudah login. Atur Power Plan ke “Never sleep” dan aktifkan auto-login
            Windows.
          </p>

          {version && <span className="mt-auto text-[13px] font-semibold text-muted-foreground">Versi {version}</span>}
        </div>

        {/* Quick bells */}
        <section className="flex w-[290px] shrink-0 flex-col gap-2.5 self-start rounded-3xl border bg-card p-5">
          <div className="flex flex-col pb-1">
            <h2 className="font-display text-lg font-semibold">Tombol bel manual</h2>
            <p className="text-[13px] font-semibold text-muted-foreground">Tampil di Dasbor untuk keadaan darurat.</p>
          </div>
          {data.settings.quickBells.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQuickDialog({ bell: q })}
              className="flex h-[58px] items-center gap-3 rounded-xl border-2 px-3 text-left hover:bg-muted"
            >
              <IconTile icon={QUICK_ICONS[q.icon]} color={q.color} className="[&_svg]:size-4" />
              <span className="flex min-w-0 flex-1 flex-col">
                <OverflowText text={q.label} className="text-sm font-extrabold" />
                <OverflowText text={q.soundFileName} className="text-xs font-semibold text-muted-foreground" />
              </span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
          <Button variant="dashed" className="h-11" onClick={() => setQuickDialog({})}>
            <Plus />
            Tambah tombol
          </Button>
        </section>
      </div>

      <FormDialog
        open={!!quickDialog}
        onClose={() => setQuickDialog(null)}
        title={quickDialog?.bell ? "Ubah tombol bel" : "Tombol bel baru"}
        className="sm:max-w-[440px]"
      >
        <QuickBellForm
          bell={quickDialog?.bell}
          onClose={() => setQuickDialog(null)}
          onSave={async (q) => void (await save((d) => saveQuickBell(d, q)))}
          onDelete={async (id) => void (await save((d) => deleteQuickBell(d, id)))}
        />
      </FormDialog>
    </div>
  );
}

function CardHead({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex flex-col">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-[13px] font-semibold text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

const COLORS: QuickBellColor[] = ["coral", "blue", "green", "sun"];
const ICONS = Object.keys(QUICK_ICONS) as QuickBellIcon[];

function QuickBellForm({
  bell,
  onClose,
  onSave,
  onDelete,
}: {
  bell?: QuickBell;
  onClose: () => void;
  onSave: (q: QuickBell) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<QuickBell>(
    () => bell ?? { id: newId(), label: "", soundFileName: "", color: "coral", icon: "siren" },
  );
  const [sounds, setSounds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<QuickBell>) => setForm((f) => ({ ...f, ...patch }));
  const id = useId();

  useEffect(() => {
    api.listSounds().then(
      (list) => {
        const names = list.map((s) => s.name);
        setSounds(names);
        setForm((f) => (f.soundFileName ? f : { ...f, soundFileName: names[0] ?? "" }));
      },
      (e) => setError(message(e)),
    );
  }, []);

  async function attempt(action: () => Promise<void>) {
    if (saving) return;
    setSaving(true);
    try {
      await action();
      onClose();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    attempt(() => onSave(form));
  }

  async function remove() {
    if (bell && (await api.confirmDelete(`Hapus tombol "${bell.label}"?`))) attempt(() => onDelete(bell.id));
  }

  const Icon = QUICK_ICONS[form.icon];

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Live preview of the dashboard button */}
      <div className={cn("flex h-[54px] items-center gap-3 rounded-xl px-4 text-[15px] font-extrabold", SOLID[form.color])}>
        <Icon className="size-5 shrink-0" />
        <OverflowText text={form.label || "Nama tombol"} />
      </div>

      <Field label="Nama tombol" htmlFor={`${id}-name`}>
        <Input
          id={`${id}-name`}
          required
          autoFocus
          value={form.label}
          placeholder="Bel Darurat"
          onChange={(e) => set({ label: e.target.value })}
        />
      </Field>

      <Field label="Suara" htmlFor={`${id}-sound`}>
        {sounds.length === 0 ? (
          <p className="text-[13px] font-semibold text-muted-foreground">
            Belum ada suara. Tambahkan dulu di Galeri Suara.
          </p>
        ) : (
          <Select value={form.soundFileName} onValueChange={(v) => set({ soundFileName: v })}>
            <SelectTrigger id={`${id}-sound`} className="w-full">
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
        )}
      </Field>

      <div className="flex flex-col gap-5">
        <Field label="Warna">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={form.color === c}
                onClick={() => set({ color: c })}
                className={cn(
                  "size-9 rounded-md ring-offset-2 ring-offset-card",
                  SOLID[c],
                  form.color === c && "ring-3 ring-ink",
                )}
              />
            ))}
          </div>
        </Field>
        <Field label="Ikon">
          <div className="flex gap-1.5">
            {ICONS.map((key) => {
              const I = QUICK_ICONS[key];
              const on = form.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={on}
                  onClick={() => set({ icon: key })}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md",
                    on ? "bg-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <I className="size-4" />
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogFooter className="sm:justify-between">
        {bell ? (
          <Button type="button" variant="soft-danger" onClick={remove}>
            <Trash2 />
            Hapus
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            Simpan
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

