import { useState } from "react";
import { Check, Copy, Music, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryDot, DayChips, OverflowText, PageHeader } from "@/components/bell-ui";
import * as api from "@/lib/api";
import {
  addTemplate,
  categoryOf,
  deleteBell,
  deleteTemplate,
  renameTemplate,
  saveBell,
  saveCategory,
  setActiveTemplate,
  type AppData,
  type Bell,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { BellDialog, TemplateDialog, type TemplateDialogState } from "./JadwalDialogs";

export default function Jadwal({
  data,
  save,
  apply,
}: {
  data: AppData;
  /** Applies an edit to the latest data and saves; rejects with a user-facing message. */
  save: (edit: (d: AppData) => AppData) => Promise<AppData>;
  /** Applies an edit and saves; errors go to the app's error banner. */
  apply: (edit: (d: AppData) => AppData) => void;
}) {
  const activeId = data.settings.activeTemplateId;
  const [selectedId, setSelectedId] = useState(activeId);
  // Falls back to the active template when the selected one was deleted.
  const selected =
    data.templates.find((t) => t.id === selectedId) ??
    data.templates.find((t) => t.id === activeId) ??
    data.templates[0];
  const isActive = selected.id === activeId;

  const [bellDialog, setBellDialog] = useState<{ bell?: Bell } | null>(null);
  const [templateDialog, setTemplateDialog] = useState<TemplateDialogState | null>(null);

  async function submitTemplate(state: TemplateDialogState, name: string, copyFromId?: string) {
    if (state.mode === "rename") {
      await save((d) => renameTemplate(d, state.id, name));
      return;
    }
    const next = await save((d) => addTemplate(d, name, copyFromId));
    setSelectedId(next.templates[next.templates.length - 1].id);
  }

  async function removeTemplate() {
    if (await api.confirmDelete(`Hapus template "${selected.name}" beserta ${selected.bells.length} belnya?`))
      apply((d) => deleteTemplate(d, selected.id));
  }

  async function removeBell(b: Bell) {
    if (await api.confirmDelete(`Hapus bel "${b.label}" jam ${b.time}?`))
      apply((d) => deleteBell(d, selected.id, b.id));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-7">
      <PageHeader title="Jadwal" subtitle="Atur template dan jam bel. Hanya template aktif yang dibunyikan." />

      <div className="flex min-h-0 flex-1 gap-[18px]">
        {/* Templates */}
        <div className="flex w-[180px] shrink-0 flex-col gap-2">
          <span className="px-1 text-xs font-extrabold tracking-[0.6px] text-muted-foreground uppercase">Template</span>
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {data.templates.map((t) => {
              const on = t.id === selected.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-current={on}
                  className={cn(
                    "flex h-[52px] shrink-0 items-center justify-between gap-2 rounded-xl border-2 px-3.5 text-left text-[15px]",
                    on ? "border-sun bg-sun-soft font-extrabold" : "border-border bg-card font-bold hover:bg-muted",
                  )}
                >
                  <OverflowText text={t.name} />
                  {t.id === activeId ? (
                    <Badge variant="success">
                      <Check />
                      Aktif
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-[13px] font-bold text-muted-foreground">{t.bells.length} bel</span>
                  )}
                </button>
              );
            })}
          </div>
          <Button variant="dashed" className="h-12 shrink-0" onClick={() => setTemplateDialog({ mode: "new" })}>
            <Plus />
            Template baru
          </Button>
        </div>

        {/* Bells of the selected template */}
        <section className="@container flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-3xl border bg-card p-5">
          {/* Wraps the buttons under the name when the window is narrow. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="min-w-0 font-display text-[22px] font-semibold">
                <OverflowText text={selected.name} />
              </h2>
              <Button
                size="icon"
                variant="ghost"
                className="bg-muted"
                aria-label="Ganti nama"
                title="Ganti nama"
                onClick={() => setTemplateDialog({ mode: "rename", id: selected.id, name: selected.name })}
              >
                <Pencil />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="bg-muted"
                aria-label="Duplikat"
                title="Duplikat"
                onClick={() =>
                  setTemplateDialog({ mode: "new", copyFromId: selected.id, name: `${selected.name} (salinan)` })
                }
              >
                <Copy />
              </Button>
              <Button
                size="icon"
                variant="soft-danger"
                aria-label="Hapus template"
                title={isActive ? "Template aktif tidak bisa dihapus" : "Hapus template"}
                disabled={isActive}
                onClick={removeTemplate}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isActive && (
                <Button variant="outline-success" onClick={() => apply((d) => setActiveTemplate(d, selected.id))}>
                  <Check />
                  Jadikan aktif
                </Button>
              )}
              <Button onClick={() => setBellDialog({})}>
                <Plus />
                Tambah bel
              </Button>
            </div>
          </div>

          <div className="flex h-9 shrink-0 items-center gap-2.5 rounded-lg bg-muted px-3 text-xs font-extrabold tracking-[0.5px] text-muted-foreground uppercase">
            <span className="w-[72px]">Waktu</span>
            <span className="flex-1">Label</span>
            <span className="w-[152px]">Hari</span>
            {/* Narrow window: drop the sound column (still shown in the edit dialog). */}
            <span className="w-[118px] @max-[500px]:hidden">Suara</span>
            <span className="w-[56px] text-right">Aksi</span>
          </div>

          {selected.bells.length === 0 ? (
            <p className="px-3 py-6 text-sm font-semibold text-muted-foreground">
              Belum ada bel di template ini. Klik “Tambah bel”.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col overflow-y-auto">
              {selected.bells.map((b) => (
                <div key={b.id} className="flex h-[52px] shrink-0 items-center gap-2.5 border-b px-3 last:border-b-0">
                  <div className="flex w-[72px] shrink-0 items-center gap-2">
                    <CategoryDot color={categoryOf(data, b.category).color} />
                    <span className="font-display text-base font-semibold">{b.time}</span>
                  </div>
                  <OverflowText text={b.label} className="min-w-0 flex-1 text-[15px] font-bold" />
                  <div className="w-[152px] shrink-0">
                    <DayChips days={b.days} />
                  </div>
                  <div className="flex w-[118px] shrink-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground @max-[500px]:hidden">
                    <Music className="size-3.5 shrink-0" />
                    <OverflowText text={b.soundFileName} />
                  </div>
                  <div className="flex w-[56px] shrink-0 justify-end gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Ubah ${b.label}`}
                      onClick={() => setBellDialog({ bell: b })}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-coral hover:text-coral"
                      aria-label={`Hapus ${b.label}`}
                      onClick={() => removeBell(b)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <BellDialog
        open={!!bellDialog}
        bell={bellDialog?.bell}
        templateName={selected.name}
        data={data}
        onAddCategory={async (c) => void (await save((d) => saveCategory(d, c)))}
        onClose={() => setBellDialog(null)}
        onSave={async (bell) => void (await save((d) => saveBell(d, selected.id, bell)))}
      />
      <TemplateDialog
        state={templateDialog}
        data={data}
        onClose={() => setTemplateDialog(null)}
        onSubmit={submitTemplate}
      />
    </div>
  );
}
