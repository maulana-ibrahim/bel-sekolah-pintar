// Add / edit / remove one bell type. Used on the Jenis Bel screen and from
// the Tambah bel dialog ("+ Jenis baru").
import { useId, useState } from "react";
import { Pipette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorNote, Field, message } from "@/components/form";
import * as api from "@/lib/api";
import { categoryUsage, newId, type AppData, type Category } from "@/lib/data";
import { OverflowText } from "@/components/bell-ui";
import { cn } from "@/lib/utils";

/** Quick picks; any other color comes from the free picker next to them. */
const PRESET_COLORS = [
  "#ef4444", "#ff6b4a", "#f97316", "#ffc53d", "#84cc16", "#12a37f",
  "#14b8a6", "#2f6bff", "#8b5cf6", "#ec4899", "#a16207", "#64748b",
];

export function CategoryForm({
  category,
  data,
  onClose,
  onSave,
  onDelete,
}: {
  category?: Category;
  data: AppData;
  onClose: () => void;
  onSave: (c: Category) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  // Colors other types already use, so the same color can't mean two things.
  const takenBy = new Map(
    data.settings.categories.filter((c) => c.id !== category?.id).map((c) => [c.color.toLowerCase(), c.name]),
  );
  const [form, setForm] = useState<Category>(
    () => category ?? { id: newId(), name: "", color: PRESET_COLORS.find((c) => !takenBy.has(c)) ?? "#000000" },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();
  const usage = category ? categoryUsage(data, category.id) : [];
  const custom = !PRESET_COLORS.includes(form.color.toLowerCase());
  const customTaken = custom ? takenBy.get(form.color.toLowerCase()) : undefined;

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

  async function remove() {
    if (category && (await api.confirmDelete(`Hapus jenis bel "${category.name}"?`)))
      attempt(() => onDelete(category.id));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        attempt(() => onSave(form));
      }}
      className="flex flex-col gap-5"
    >
      <Field label="Nama jenis" htmlFor={`${id}-name`}>
        <Input
          id={`${id}-name`}
          required
          autoFocus
          value={form.name}
          placeholder="Contoh: Upacara"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </Field>

      <Field label="Warna">
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => {
            const on = form.color.toLowerCase() === c;
            const owner = takenBy.get(c);
            return (
              <button
                key={c}
                type="button"
                aria-label={owner ? `Warna ${c}, sudah dipakai ${owner}` : `Warna ${c}`}
                title={owner ? `Sudah dipakai "${owner}"` : undefined}
                aria-pressed={on}
                disabled={!!owner}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                style={{ backgroundColor: c }}
                className={cn(
                  "relative size-8 rounded-full ring-offset-2 ring-offset-card",
                  on && "ring-3 ring-ink",
                  // Taken: faded with a slash, still shows which color it is.
                  owner &&
                    "cursor-not-allowed opacity-35 after:absolute after:inset-x-1 after:top-1/2 after:h-0.5 after:-rotate-45 after:rounded after:bg-ink",
                )}
              />
            );
          })}
          {/* Free choice: the native color picker behind a round button. */}
          <label
            title="Warna lain"
            style={custom ? { backgroundColor: form.color } : undefined}
            className={cn(
              "relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-card",
              custom ? "text-white ring-3 ring-ink" : "border-2 border-dashed text-muted-foreground",
            )}
          >
            <Pipette className="size-3.5 drop-shadow" />
            <input
              type="color"
              aria-label="Warna lain"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        {/* The free picker can land on a taken color too: say so right away. */}
        {customTaken && (
          <span className="text-xs font-bold text-coral">Warna ini sudah dipakai “{customTaken}”. Pilih warna lain.</span>
        )}
      </Field>

      {category && usage.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-muted p-3.5">
          <span className="text-[13px] font-extrabold">Dipakai oleh {usage.length} bel</span>
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-[13px] font-semibold">
            {usage.map(({ templateName, bell }) => (
              <li key={bell.id} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground">{templateName}</span>
                <span className="shrink-0 font-display">{bell.time}</span>
                <OverflowText text={bell.label} />
              </li>
            ))}
          </ul>
          <span className="text-xs font-semibold text-muted-foreground">
            Untuk menghapus jenis ini, ganti dulu jenis bel-bel di atas di menu Jadwal.
          </span>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <DialogFooter className="sm:justify-between">
        {category ? (
          <Button
            type="button"
            variant="soft-danger"
            disabled={usage.length > 0}
            title={usage.length > 0 ? "Masih dipakai bel" : undefined}
            onClick={remove}
          >
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
