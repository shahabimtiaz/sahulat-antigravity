import { NextResponse } from "next/server";
import { listSkills, listWorkflows } from "@/lib/agents/skill-loader";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const [skills, workflows] = await Promise.all([listSkills(), listWorkflows()]);

  const supabase = getAdminSupabase();
  // Recent activity per agent (last 200 events overall, last hour).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: traces } = await supabase
    .from("traces")
    .select("agent, step, rationale, latency_ms, model, confidence, booking_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  // Aggregate per agent.
  const perAgent = new Map<string, { runs: number; latency_total: number; latest: string | null; last_rationale: string | null }>();
  for (const t of traces ?? []) {
    const a = t.agent as string;
    const cur = perAgent.get(a) ?? { runs: 0, latency_total: 0, latest: null, last_rationale: null };
    cur.runs += 1;
    cur.latency_total += t.latency_ms ?? 0;
    if (!cur.latest) { cur.latest = t.created_at as string; cur.last_rationale = (t.rationale as string) ?? null; }
    perAgent.set(a, cur);
  }

  const agents = [
    "orchestrator", "intent", "discovery", "matcher", "pricer", "scheduler",
    "booking", "notification", "quality", "dispute", "fallback",
  ].map((a) => {
    const s = perAgent.get(a) ?? { runs: 0, latency_total: 0, latest: null, last_rationale: null };
    return {
      agent: a,
      runs_24h: s.runs,
      avg_latency_ms: s.runs ? Math.round(s.latency_total / s.runs) : 0,
      latest_at: s.latest,
      last_rationale: s.last_rationale,
    };
  });

  // Artifacts: recent confirmed bookings + disputes.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, request_text, service, status, total_price, scheduled_start, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, booking_id, case_type, decision, refund_amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    skills: skills.map((s) => ({ name: s.name, description: s.description, body_length: s.body.length, path: s.path })),
    workflows: workflows.map((w) => ({ name: w.name, description: w.description, body_length: w.body.length, path: w.path })),
    agents,
    recent_traces: (traces ?? []).slice(0, 40),
    artifacts: {
      bookings: bookings ?? [],
      disputes: disputes ?? [],
    },
  });
}
