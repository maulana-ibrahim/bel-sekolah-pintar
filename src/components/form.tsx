// Pieces shared by every form dialog in the app.
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const pad = (v: string) => v.padStart(2, "0");

/** 24-hour "HH:mm" entry as two boxes. Typing the hour jumps to the minutes
 *  (after 2 digits, or 1 digit above 2), Backspace in empty minutes goes back,
 *  ↑/↓ step the value, and clicking either part focuses that part.
 *  Emits "" until both parts are filled. */
export function TimeInput({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  autoFocus?: boolean;
}) {
  const [hour, setHour] = useState(value.slice(0, 2));
  const [minute, setMinute] = useState(value.slice(3, 5));
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  const emit = (h: string, m: string) => onChange(h && m ? `${pad(h)}:${pad(m)}` : "");
  const digits = (raw: string) => raw.replace(/\D/g, "").slice(0, 2);

  function typeHour(raw: string) {
    let h = digits(raw);
    if (+h > 23) h = "23";
    const done = h.length === 2 || (h.length === 1 && +h > 2); // "7" can only mean 07
    if (done) h = pad(h);
    setHour(h);
    emit(h, minute);
    if (done) {
      minuteRef.current?.focus();
      minuteRef.current?.select();
    }
  }

  function typeMinute(raw: string) {
    let m = digits(raw);
    if (+m > 59) m = "59";
    if (m.length === 1 && +m > 5) m = pad(m); // "7" can only mean 07
    setMinute(m);
    emit(hour, m);
  }

  function step(e: KeyboardEvent<HTMLInputElement>, part: "h" | "m") {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const max = part === "h" ? 24 : 60;
    const cur = +(part === "h" ? hour : minute) || 0;
    const next = pad(String((cur + (e.key === "ArrowUp" ? 1 : max - 1)) % max));
    if (part === "h") {
      setHour(next);
      emit(next, minute);
    } else {
      setMinute(next);
      emit(hour, next);
    }
  }

  const box = "w-[2.4ch] bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground/60";
  return (
    <div className="flex h-12 items-center rounded-xl border-2 border-input bg-card px-3 font-display text-lg font-semibold focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <input
        ref={hourRef}
        id={id}
        aria-label="Jam"
        inputMode="numeric"
        placeholder="--"
        required
        autoFocus={autoFocus}
        value={hour}
        onFocus={(e) => e.target.select()}
        onChange={(e) => typeHour(e.target.value)}
        // "1" left alone means 01 (display only; the emitted value is already padded).
        onBlur={() => hour.length === 1 && setHour(pad(hour))}
        onKeyDown={(e) => {
          step(e, "h");
          if (e.key === ":" || (e.key === "ArrowRight" && e.currentTarget.selectionStart === hour.length)) {
            e.preventDefault();
            minuteRef.current?.focus();
          }
        }}
        className={box}
      />
      <span className="px-0.5 text-muted-foreground">:</span>
      <input
        ref={minuteRef}
        aria-label="Menit"
        inputMode="numeric"
        placeholder="--"
        required
        value={minute}
        onFocus={(e) => e.target.select()}
        onChange={(e) => typeMinute(e.target.value)}
        onBlur={() => minute.length === 1 && setMinute(pad(minute))}
        onKeyDown={(e) => {
          step(e, "m");
          if ((e.key === "Backspace" && !minute) || (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0)) {
            e.preventDefault();
            hourRef.current?.focus();
          }
        }}
        className={box}
      />
    </div>
  );
}

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-coral-soft px-3.5 py-2.5 text-[13px] font-bold text-coral">
      {children}
    </p>
  );
}

/** `htmlFor` ties the label to its control (screen readers, click-to-focus). */
export function Field({
  label,
  htmlFor,
  children,
  extra,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor} className="text-[13px] font-extrabold">
          {label}
        </Label>
        {extra}
      </div>
      {children}
    </div>
  );
}

/** Dialog shell; its form is mounted fresh (empty state) every time it opens. */
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Never taller than the window: the dialog itself scrolls instead of
          pushing its title and buttons off screen. */}
      <DialogContent className={cn("max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-3xl p-6", className)}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-semibold">{title}</DialogTitle>
          <DialogDescription className={cn("text-[13px] font-semibold", !subtitle && "sr-only")}>
            {subtitle ?? title}
          </DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}
