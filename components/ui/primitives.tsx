import { cn } from "@/lib/utils/cn";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4 ring-soft animate-fade-in",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const v = {
    primary: "bg-brand text-white hover:bg-brand-soft",
    secondary: "bg-bg-elev text-ink border border-line hover:bg-bg-soft",
    ghost: "bg-transparent text-ink hover:bg-bg-elev",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  const s = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-sm", lg: "h-12 px-5 text-base" }[size];
  return (
    <button className={cn(base, v, s, className)} {...rest}>
      {children}
    </button>
  );
}

export function Badge({ tone = "default", children, className }: { tone?: "default" | "accent" | "warn" | "danger" | "brand"; children: ReactNode; className?: string }) {
  const tones = {
    default: "bg-bg-elev text-ink-muted border-line",
    accent: "bg-accent/10 text-accent border-accent/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    brand: "bg-brand/10 text-brand-soft border-brand/30",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones, className)}>
      {children}
    </span>
  );
}

export function Section({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3 animate-slide-up">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-ink-dim">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function StatBar({ label, value, max = 100, tone = "brand" }: { label: string; value: number; max?: number; tone?: "brand" | "accent" | "warn" | "danger" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = { brand: "bg-brand", accent: "bg-accent", warn: "bg-warn", danger: "bg-danger" }[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono text-ink">{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-bg-soft overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
