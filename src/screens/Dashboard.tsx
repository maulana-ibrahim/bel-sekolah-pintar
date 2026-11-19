import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BellRow, CategoryDot, OverflowText, QUICK_ICONS, SOLID } from "@/components/bell-ui";
import * as api from "@/lib/api";
import { activeTemplate, categoryOf, formatCountdown, hhmm, secondsUntil, todaySchedule, type AppData } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Current time, refreshed every second. Display only: ringing is done in Rust. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const dateLabel = (d: Date) =>
  d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function Dashboard({ data, run }: { data: AppData; run: (p: Promise<unknown>) => void }) {
  const now = useNow();
  const time = hhmm(now);
  const { bells, next, doneCount } = todaySchedule(data, now);
  const legend = data.settings.categories.filter((c) => bells.some((b) => b.category === c.id));
  const quickBells = data.settings.quickBells;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[22px] p-7">
      {/* Clock + next bell */}
      <div className="flex gap-[18px]">
        <div className="@container flex min-h-[190px] min-w-0 flex-1 flex-col justify-between rounded-3xl bg-blue p-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-[15px] font-bold">{dateLabel(now)}</span>
            {/* A long template name shrinks here instead of pushing the date out. */}
            <OverflowText
              text={`Template ${activeTemplate(data)?.name ?? "—"}`}
              className="rounded-full bg-white px-3 py-1 text-[13px] font-extrabold text-blue"
            />
          </div>
          <div className="font-display leading-[0.95] font-semibold tracking-[-2.6px] tabular-nums">
            {/* Scales down with the card so it fits the 900px minimum window. */}
            <span className="text-[min(104px,24cqw)]">{time}</span>
            <span className="text-[min(44px,10cqw)] text-blue-soft"> :{String(now.getSeconds()).padStart(2, "0")}</span>
          </div>
        </div>

        <div className="flex w-[270px] shrink-0 flex-col justify-between gap-4 rounded-3xl bg-sun p-[22px] text-ink">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-extrabold tracking-[0.65px] uppercase">Bel berikutnya</span>
            {next ? (
              <>
                <OverflowText text={next.label} className="font-display text-[28px] leading-[1.1] font-semibold" />
                <OverflowText text={`${next.time} · ${next.soundFileName}`} className="text-sm font-semibold" />
              </>
            ) : (
              <span className="font-display text-[22px] leading-[1.15] font-semibold">
                Tidak ada bel lagi hari ini
              </span>
            )}
          </div>
          {next && (
            <div className="flex items-baseline gap-1.5 self-start rounded-full bg-ink px-4 py-2 text-sun">
              <span className="font-display text-[28px] leading-none font-semibold tabular-nums">
                {formatCountdown(secondsUntil(next.time, now))}
              </span>
              <span className="text-[13px] font-bold">lagi</span>
            </div>
          )}
        </div>
      </div>

      {/* Today's list + manual bells */}
      <div className="flex min-h-0 flex-1 gap-[18px]">
        <section className="flex min-h-0 flex-1 flex-col gap-1 rounded-3xl border bg-card p-[18px]">
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Jadwal hari ini</h2>
            <span className="text-[13px] font-bold text-muted-foreground">
              {bells.length} bel · {doneCount} selesai
            </span>
          </div>
          {/* Color legend for today's dots: one line that never pushes the list
              down. Only the types on today's list; extra ones scroll sideways
              (mouse wheel works too). */}
          {legend.length > 0 && (
            <div
              className="mb-2 flex shrink-0 gap-x-4 overflow-x-auto px-3 pb-1 [scrollbar-width:thin]"
              onWheel={(e) => {
                if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY;
              }}
            >
              {legend.map((c) => (
                <span
                  key={c.id}
                  className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-muted-foreground"
                >
                  <CategoryDot color={c.color} />
                  {c.name}
                </span>
              ))}
            </div>
          )}
          {bells.length === 0 ? (
            <p className="px-3 py-6 text-sm font-semibold text-muted-foreground">
              Tidak ada bel hari ini di template aktif. Atur di menu Jadwal.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {bells.map((b) => (
                <BellRow
                  key={b.id}
                  time={b.time}
                  label={b.label}
                  color={categoryOf(data, b.category).color}
                  state={b === next ? "next" : b.time <= time ? "done" : "upcoming"}
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex w-[270px] shrink-0 flex-col gap-2.5">
          <h2 className="font-display text-xl font-semibold">Bel manual</h2>
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
            {quickBells.map((q) => {
              const Icon = QUICK_ICONS[q.icon];
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => run(api.playSound(q.soundFileName))}
                  className={cn(
                    "flex h-[54px] shrink-0 items-center gap-3 rounded-xl px-4 text-left text-[15px] font-extrabold transition-opacity hover:opacity-90 active:translate-y-px",
                    SOLID[q.color],
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <OverflowText text={q.label} />
                </button>
              );
            })}
            {quickBells.length === 0 && (
              <p className="text-[13px] font-semibold text-muted-foreground">
                Belum ada tombol. Tambahkan di Pengaturan.
              </p>
            )}
          </div>
          <Button variant="outline" className="h-11 shrink-0" onClick={() => run(api.stopSound())}>
            <Square className="size-3.5" />
            Hentikan suara
          </Button>
          <div className="mt-auto flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <Volume2 className="size-[15px] shrink-0" />
            <OverflowText text={data.settings.audioOutputName || "Speaker bawaan sistem"} />
          </div>
        </section>
      </div>
    </div>
  );
}
