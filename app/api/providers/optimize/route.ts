import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

/**
 * Provider-side optimization: returns demand forecast for next 24h
 * and recommended slots per provider.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? "Islamabad";
  const supabase = getAdminSupabase();

  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, name, primary_service, area, daily_capacity, jobs_today, hourly_rate, on_time_score, rating_avg")
    .eq("city", city)
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Naive demand forecast by service+area from recent bookings (last 7d).
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("bookings")
    .select("service, location_raw, scheduled_start")
    .gte("scheduled_start", since);

  type DemandKey = string;
  const baseline: Record<DemandKey, number> = {};
  for (const b of recent ?? []) {
    const hour = new Date(b.scheduled_start as string).getHours();
    const key = `${b.service}::${(b.location_raw ?? "").slice(0, 10)}::${hour}`;
    baseline[key] = (baseline[key] ?? 0) + 1;
  }

  const recommendations = (providers ?? []).map((p) => {
    const utilization = p.jobs_today / Math.max(1, p.daily_capacity);
    // suggested slots: top 3 hour buckets with highest demand for that service in this city
    const slots = Object.entries(baseline)
      .filter(([k]) => k.startsWith(`${p.primary_service}::`))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => Number(k.split("::")[2]))
      .map((h) => `${String(h).padStart(2, "0")}:00`);
    return {
      provider_id: p.id,
      name: p.name,
      utilization,
      suggested_slots: slots,
      reason: utilization < 0.3
        ? "Under-utilized — surfaced top demand hours to fill schedule."
        : "Normal utilization — slots reflect peak demand windows.",
    };
  });

  const forecast = Object.entries(baseline)
    .map(([k, count]) => {
      const [service, area, hour] = k.split("::");
      return { service, area, hour: Number(hour), expected_jobs: count };
    })
    .sort((a, b) => b.expected_jobs - a.expected_jobs)
    .slice(0, 20);

  return NextResponse.json({ recommendations, demand_forecast: forecast });
}
