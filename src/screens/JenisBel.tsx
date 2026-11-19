import { useState } from "react";
import { Lock, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OverflowText, PageHeader } from "@/components/bell-ui";
import { categoryUsage, deleteCategory, saveCategory, type AppData, type Category } from "@/lib/data";
import { CategoryForm } from "@/components/CategoryForm";
import { FormDialog } from "@/components/form";

export default function JenisBel({
  data,
  save,
}: {
  data: AppData;
  save: (edit: (d: AppData) => AppData) => Promise<AppData>;
}) {
  const [dialog, setDialog] = useState<{ category?: Category } | null>(null);
  const categories = data.settings.categories;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-7">
      <PageHeader
        title="Jenis Bel"
        subtitle="Nama dan warna penanda bel di Dasbor dan Jadwal."
        action={
          <Button className="h-11 px-5 text-[15px]" onClick={() => setDialog({})}>
            <Plus />
            Tambah jenis
          </Button>
        }
      />

      <section className="flex min-h-0 flex-col gap-1 rounded-3xl border bg-card p-[18px]">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="font-display text-xl font-semibold">Semua jenis</h2>
          <span className="text-[13px] font-bold text-muted-foreground">{categories.length} jenis</span>
        </div>
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
          {categories.map((c) => {
            const usage = categoryUsage(data, c.id);
            const templates = [...new Set(usage.map((u) => u.templateName))];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDialog({ category: c })}
                className="flex h-16 shrink-0 items-center gap-3.5 rounded-xl px-3 text-left hover:bg-muted"
              >
                <span
                  className="size-10 shrink-0 rounded-xl ring-1 ring-ink/10 ring-inset"
                  style={{ backgroundColor: c.color }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <OverflowText text={c.name} className="text-[15px] font-bold" />
                  <OverflowText
                    text={templates.length ? `Template ${templates.join(", ")}` : "Belum dipakai"}
                    className="text-[13px] font-semibold text-muted-foreground"
                  />
                </span>
                <Badge variant={usage.length ? "default" : "muted"} className="w-[100px]">
                  {usage.length ? `Dipakai ${usage.length} bel` : "Tidak dipakai"}
                </Badge>
                <Pencil className="size-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </section>

      <span className="mt-auto flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <Lock className="size-3.5" />
        Jenis yang masih dipakai bel tidak bisa dihapus. Klik jenisnya untuk melihat bel mana saja.
      </span>

      <FormDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={dialog?.category ? "Ubah jenis bel" : "Jenis bel baru"}
        className="sm:max-w-[440px]"
      >
        <CategoryForm
          category={dialog?.category}
          data={data}
          onClose={() => setDialog(null)}
          onSave={async (c) => void (await save((d) => saveCategory(d, c)))}
          onDelete={async (id) => void (await save((d) => deleteCategory(d, id)))}
        />
      </FormDialog>
    </div>
  );
}

