import { useCallback, useEffect, useState } from "react";
import { Folder, Lock, Pause, Play, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OverflowText, PageHeader } from "@/components/bell-ui";
import * as api from "@/lib/api";
import { soundUsage, type AppData } from "@/lib/data";
import { cn } from "@/lib/utils";

const num = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${num.format(bytes / 1024 / 1024)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
const extension = (name: string) => name.split(".").pop()?.toUpperCase() ?? "";

/** The preview started from this screen. Progress is estimated from the start
 *  time; a bell or another preview playing meanwhile isn't reflected here. */
interface Playing {
  name: string;
  startedAt: number;
  durationSecs: number;
}

export default function Suara({ data, run }: { data: AppData; run: (p: Promise<unknown>) => void }) {
  const [sounds, setSounds] = useState<api.SoundInfo[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(() => run(api.listSounds().then(setSounds)), [run]);
  useEffect(refresh, [refresh]);

  // Tick while a preview plays; clear it once its duration has passed.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - playing.startedAt > playing.durationSecs * 1000) setPlaying(null);
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  function togglePlay(s: api.SoundInfo) {
    if (playing?.name === s.name) {
      setPlaying(null);
      run(api.stopSound());
      return;
    }
    run(
      api.playSound(s.name).then(() => {
        // Unknown length: just play; there'd be no way to tell when it ends.
        if (s.durationSecs === null) return setPlaying(null);
        const started = Date.now();
        setNow(started);
        setPlaying({ name: s.name, startedAt: started, durationSecs: s.durationSecs });
      }),
    );
  }

  function add() {
    run(api.importSound().then((stored) => stored && refresh()));
  }

  async function remove(name: string) {
    if (!(await api.confirmDelete(`Hapus suara "${name}"? File di folder aplikasi ikut terhapus.`))) return;
    // Stop first so the file isn't held open by the player while deleting.
    const stopFirst = playing?.name === name ? api.stopSound() : Promise.resolve();
    if (playing?.name === name) setPlaying(null);
    run(stopFirst.then(() => api.deleteSound(name)).then(refresh));
  }

  const totalBytes = sounds.reduce((sum, s) => sum + s.sizeBytes, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-7">
      <PageHeader
        title="Galeri Suara"
        subtitle="File disalin ke folder aplikasi, jadi aman walau file aslinya dihapus."
        action={
          <Button variant="success" className="h-11 px-5 text-[15px]" onClick={add}>
            <Upload />
            Tambah suara
          </Button>
        }
      />

      <section className="flex min-h-0 flex-col gap-1 rounded-3xl border bg-card p-[18px]">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="font-display text-xl font-semibold">Semua suara</h2>
          <span className="text-[13px] font-bold text-muted-foreground">
            {sounds.length} file · {formatSize(totalBytes)}
          </span>
        </div>

        {sounds.length === 0 && (
          <p className="px-1 py-6 text-sm font-semibold text-muted-foreground">
            Belum ada suara. Klik “Tambah suara” untuk memilih file .mp3 atau .wav.
          </p>
        )}

        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
          {sounds.map((s) => {
            const used = soundUsage(data, s.name);
            const isPlaying = playing?.name === s.name;
            const elapsed = isPlaying ? (now - playing.startedAt) / 1000 : 0;
            return (
              <div
                key={s.name}
                className={cn(
                  "flex h-16 shrink-0 items-center gap-3.5 rounded-xl border-2 px-3",
                  isPlaying ? "border-green bg-green-soft" : "border-transparent",
                )}
              >
                <Button
                  size="icon-lg"
                  variant={isPlaying ? "success" : "outline"}
                  className={cn(!isPlaying && "border-transparent bg-muted text-foreground")}
                  aria-label={isPlaying ? `Hentikan ${s.name}` : `Putar ${s.name}`}
                  onClick={() => togglePlay(s)}
                >
                  {isPlaying ? <Pause /> : <Play />}
                </Button>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <OverflowText text={s.name} className={cn("text-[15px]", isPlaying ? "font-extrabold" : "font-bold")} />
                    {s.name === api.DEFAULT_SOUND && <Badge variant="white">Bawaan</Badge>}
                  </div>
                  {isPlaying && s.durationSecs ? (
                    <div className="h-1.5 w-full rounded-full bg-card">
                      <div
                        className="h-1.5 rounded-full bg-green"
                        style={{ width: `${Math.min(100, (elapsed / s.durationSecs) * 100)}%` }}
                      />
                    </div>
                  ) : (
                    <span className="text-[13px] font-semibold text-muted-foreground">
                      {[extension(s.name), s.durationSecs !== null && formatDuration(s.durationSecs), formatSize(s.sizeBytes)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>

                <span className="w-[86px] text-right font-display text-sm font-semibold tabular-nums">
                  {isPlaying && s.durationSecs
                    ? `${formatDuration(Math.min(elapsed, s.durationSecs))} / ${formatDuration(s.durationSecs)}`
                    : ""}
                </span>

                <Badge variant={used ? "default" : "muted"} className="w-[120px]">
                  {used ? `Dipakai ${used} bel` : "Tidak dipakai"}
                </Badge>

                {used ? (
                  <span
                    className="flex size-9 shrink-0 items-center justify-center text-muted-foreground"
                    title="Masih dipakai di jadwal atau tombol bel manual"
                  >
                    <Lock className="size-4" />
                  </span>
                ) : (
                  <Button
                    size="icon"
                    variant="soft-danger"
                    className="size-9"
                    aria-label={`Hapus ${s.name}`}
                    onClick={() => remove(s.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-auto flex items-center justify-between gap-4 text-[13px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <Lock className="size-3.5" />
          Suara yang masih dipakai di jadwal tidak bisa dihapus.
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <Folder className="size-3.5 shrink-0" />
          <OverflowText text={"%APPDATA%\\id.sch.belsekolahpintar\\sounds"} />
        </span>
      </div>
    </div>
  );
}
