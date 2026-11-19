// App-specific building blocks of the "Krayon" design (D2 on the Wonder canvas).
// Generic controls (Button, Card, Badge, Switch, Select, Dialog, Input) live in
// components/ui and come from shadcn.
import { useRef, useState, type ReactNode } from "react";
import {
  Bell as BellIcon,
  CalendarClock,
  DoorOpen,
  Flag,
  LayoutGrid,
  Megaphone,
  Music,
  Palette,
  Settings,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Day, QuickBellColor, QuickBellIcon } from "@/lib/data";

// ── Color maps (full class names so Tailwind can see them) ────────────────

/** Solid fill + readable text for each brand color. */
export const SOLID: Record<QuickBellColor, string> = {
  blue: "bg-blue text-white",
  sun: "bg-sun text-ink",
  green: "bg-green text-white",
  coral: "bg-coral text-white",
};

export const QUICK_ICONS: Record<QuickBellIcon, LucideIcon> = {
  siren: Siren,
  flag: Flag,
  door: DoorOpen,
  bell: BellIcon,
  megaphone: Megaphone,
  music: Music,
};

// ── Small pieces ──────────────────────────────────────────────────────────

/** One line of text that never hides its end: cut with "…" at rest, slides
 *  sideways on hover to show the rest, and shows the full text as a tooltip.
 *  Use it for anything the user names (labels, templates, sounds, types). */
export function OverflowText({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);
  const [shift, setShift] = useState(0);

  function start() {
    const el = box.current;
    const hidden = el ? el.scrollWidth - el.clientWidth : 0;
    if (hidden <= 0) return;
    setScrolling(true);
    // Two frames: let the unclipped text render at 0 first so the slide animates.
    requestAnimationFrame(() => requestAnimationFrame(() => setShift(hidden)));
  }

  function stop() {
    setScrolling(false);
    setShift(0);
  }

  return (
    <span
      ref={box}
      title={text}
      onMouseEnter={start}
      onMouseLeave={stop}
      className={cn("block min-w-0 overflow-hidden whitespace-nowrap", !scrolling && "text-ellipsis", className)}
    >
      {scrolling ? (
        <span
          className="inline-block transition-transform ease-linear [text-decoration:inherit]"
          // ~50px per second, after a short pause so a passing mouse doesn't trigger it.
          style={{ transform: `translateX(-${shift}px)`, transitionDuration: `${Math.max(0.6, shift / 50)}s`, transitionDelay: "0.25s" }}
        >
          {text}
        </span>
      ) : (
        text
      )}
    </span>
  );
}

/** Bell-type color dot. Any user color works: the faint ring keeps very
 *  light colors visible on white. */
export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("size-3 shrink-0 rounded-full ring-1 ring-ink/10 ring-inset", className)}
      style={{ backgroundColor: color }}
    />
  );
}

/** Colored square holding an icon (sidebar menu, settings cards, quick bells). */
export function IconTile({
  icon: Icon,
  color,
  className,
}: {
  icon: LucideIcon;
  color: QuickBellColor;
  className?: string;
}) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", SOLID[color], className)}>
      <Icon className="size-[18px]" />
    </span>
  );
}

const DAY_LETTERS = ["S", "S", "R", "K", "J", "S", "M"];

/** Seven Senin…Minggu chips; clickable when onToggle is given. */
export function DayChips({ days, onToggle }: { days: Day[]; onToggle?: (day: Day) => void }) {
  return (
    <div className="flex gap-0.5">
      {DAY_LETTERS.map((letter, i) => {
        const day = (i + 1) as Day;
        const on = days.includes(day);
        return (
          <button
            key={day}
            type="button"
            disabled={!onToggle}
            onClick={() => onToggle?.(day)}
            aria-pressed={on}
            className={cn(
              "flex size-5 items-center justify-center rounded-[6px] text-[10px] font-extrabold disabled:cursor-default",
              on ? "bg-blue text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

/** One line of the dashboard's "Jadwal hari ini" list. */
export function BellRow({
  time,
  label,
  color,
  state = "upcoming",
}: {
  time: string;
  label: string;
  /** Bell type color. */
  color: string;
  state?: "done" | "next" | "upcoming";
}) {
  return (
    <div
      className={cn(
        "flex h-[42px] items-center gap-3 rounded-lg border-2 border-transparent px-3 text-[15px] font-bold",
        state === "next" && "border-sun bg-sun-soft font-extrabold",
        state === "done" && "text-muted-foreground",
      )}
    >
      <CategoryDot color={color} className="size-3.5" />
      <span className="w-[52px] font-display text-base font-semibold">{time}</span>
      <OverflowText text={label} className={cn("flex-1", state === "done" && "line-through")} />
      {state === "next" && <Badge variant="ink">Berikutnya</Badge>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-[30px] leading-[1.1] font-semibold">{title}</h1>
        {subtitle && <p className="text-sm font-semibold text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────

export type Page = "dashboard" | "jadwal" | "jenis" | "suara" | "pengaturan";

/** Each menu item: its icon tile, and the light tint it gets when active. */
const NAV: { page: Page; label: string; icon: LucideIcon; tile: string; active: string }[] = [
  { page: "dashboard", label: "Dasbor", icon: LayoutGrid, tile: "bg-blue text-white", active: "bg-blue-soft" },
  { page: "jadwal", label: "Jadwal", icon: CalendarClock, tile: "bg-sun text-ink", active: "bg-sun-soft" },
  { page: "jenis", label: "Jenis Bel", icon: Palette, tile: "bg-purple text-white", active: "bg-purple-soft" },
  { page: "suara", label: "Galeri Suara", icon: Music, tile: "bg-green text-white", active: "bg-green-soft" },
  { page: "pengaturan", label: "Pengaturan", icon: Settings, tile: "bg-coral text-white", active: "bg-coral-soft" },
];

export function Sidebar({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  return (
    <aside className="flex w-[230px] shrink-0 flex-col gap-[26px] border-r bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-[38px] items-center justify-center rounded-lg bg-sun text-ink">
          <BellIcon className="size-5" />
        </span>
        <span className="font-display text-[19px] leading-[1.1] font-semibold">Bel Sekolah Pintar</span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = item.page === page;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => onNavigate(item.page)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[46px] items-center gap-3 rounded-lg px-2 text-left text-[15px] font-bold transition-colors",
                active ? item.active : "hover:bg-muted",
              )}
            >
              <span className={cn("flex size-[30px] shrink-0 items-center justify-center rounded-[10px]", item.tile)}>
                <item.icon className="size-4" />
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>

    </aside>
  );
}
