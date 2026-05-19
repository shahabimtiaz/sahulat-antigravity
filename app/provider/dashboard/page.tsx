import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/server";
import { Badge, Card, Section, StatBar } from "@/components/ui/primitives";
import { ArrowLeft, TrendingUp, Clock, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city = "Islamabad" } = await searchParams;
  const supabase = getAdminSupabase();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, primary_service, area, daily_capacity, jobs_today, hourly_rate, on_time_score, rating_avg, rating_count")
    .eq("city", city)
    .order("on_time_score", { ascending: false })
    .limit(20);

  // Forecast (compute inline for simplicity).
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("bookings")
    .select("service, scheduled_start")
    .gte("scheduled_start", since);

  const baseline: Record<string, number> = {};
  for (const b of recent ?? []) {
    const hour = new Date(b.scheduled_start as string).getHours();
    const key = `${b.service}::${hour}`;
    baseline[key] = (baseline[key] ?? 0) + 1;
  }
  const topForecast = Object.entries(baseline)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => {
      const [service, hour] = k.split("::");
      return { service: service.replace("_", " "), hour: Number(hour), expected_jobs: v };
    });

  return (
    <main className="mx-auto w-full max-w-md sm:max-w-3xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-ink-muted hover:text-ink"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-semibold">Provider dashboard</h1>
        <Badge tone="brand" className="ml-auto">{city}</Badge>
      </header>

      <Section title="Demand forecast" hint="Top hours by expected jobs (last 7d baseline)">
        <Card>
          {topForecast.length === 0 ? (
            <p className="text-sm text-ink-muted">No bookings yet — forecast will populate as data accrues.</p>
          ) : (
            <ul className="space-y-2">
              {topForecast.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Clock className="size-3.5 text-ink-dim" />
                  <span className="font-mono w-12 text-ink-muted">{String(f.hour).padStart(2, "0")}:00</span>
                  <span className="capitalize">{f.service}</span>
                  <span className="ml-auto"><Badge tone="brand">{f.expected_jobs} jobs</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>

      <Section title="Provider workload" hint="Sorted by on-time reliability">
        <div className="space-y-3">
          {(providers ?? []).map((p) => {
            const util = p.jobs_today / Math.max(1, p.daily_capacity);
            return (
              <Card key={p.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center text-brand-soft text-xs font-semibold shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-ink-muted">{p.primary_service.replace("_", " ")} · {p.area}</div>
                  </div>
                  <Badge tone={util > 0.7 ? "warn" : util < 0.3 ? "default" : "accent"}>
                    <Users className="size-3" /> {(util * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatBar label="on-time" value={p.on_time_score * 100} tone={p.on_time_score >= 0.9 ? "accent" : "warn"} />
                  <StatBar label="rating" value={(p.rating_avg / 5) * 100} tone="brand" />
                </div>
                <div className="text-xs text-ink-muted">
                  {util < 0.3 ? (
                    <span className="flex items-center gap-1"><TrendingUp className="size-3" /> Earning gap — pushed to peak slots.</span>
                  ) : util > 0.8 ? (
                    <span>Near capacity — matcher will deprioritize.</span>
                  ) : (
                    <span>Healthy utilization.</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </main>
  );
}
