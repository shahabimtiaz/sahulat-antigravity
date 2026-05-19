import Link from "next/link";
import { ArrowLeft, Brain, FileText, Layers, Activity, GitBranch, Receipt, MessageSquareWarning } from "lucide-react";
import { Badge, Card, Section } from "@/components/ui/primitives";
import { listSkills, listWorkflows } from "@/lib/agents/skill-loader";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AGENTS = [
  { key: "orchestrator", label: "Orchestrator", role: "Routes the workflow end-to-end", skill: "workflow:book-service" },
  { key: "intent",       label: "Intent",       role: "Multilingual parsing & confidence", skill: "intent-extraction" },
  { key: "discovery",    label: "Discovery",    role: "Places API + seed merge", skill: "provider-matching" },
  { key: "matcher",      label: "Matcher",      role: "11-factor weighted ranking", skill: "provider-matching" },
  { key: "pricer",       label: "Pricer",       role: "Transparent dynamic pricing", skill: "dynamic-pricing" },
  { key: "scheduler",    label: "Scheduler",    role: "Conflict-free slot reservation", skill: "scheduling" },
  { key: "quality",      label: "Quality",      role: "Lifecycle + sentiment + reputation", skill: "service-quality-loop" },
  { key: "dispute",      label: "Dispute",      role: "Evidence-weighted resolution", skill: "dispute-resolution" },
] as const;

const AGENT_TONE: Record<string, "brand" | "accent" | "warn" | "default" | "danger"> = {
  orchestrator: "brand", intent: "accent", discovery: "default", matcher: "brand",
  pricer: "accent", scheduler: "warn", booking: "brand", notification: "default",
  quality: "accent", dispute: "danger", fallback: "warn",
};

export default async function Page() {
  const [skills, workflows] = await Promise.all([listSkills(), listWorkflows()]);
  const supabase = getAdminSupabase();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: traces }, { data: bookings }, { data: disputes }] = await Promise.all([
    supabase.from("traces").select("agent, step, rationale, latency_ms, model, confidence, booking_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(60),
    supabase.from("bookings").select("id, request_text, service, status, total_price, scheduled_start, created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("disputes").select("id, booking_id, case_type, decision, refund_amount, status, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const perAgent = new Map<string, { runs: number; latency_total: number; latest_rationale: string | null }>();
  for (const t of traces ?? []) {
    const a = t.agent as string;
    const cur = perAgent.get(a) ?? { runs: 0, latency_total: 0, latest_rationale: null };
    cur.runs += 1;
    cur.latency_total += (t.latency_ms as number) ?? 0;
    if (!cur.latest_rationale) cur.latest_rationale = (t.rationale as string) ?? null;
    perAgent.set(a, cur);
  }

  return (
    <main className="mx-auto w-full max-w-md sm:max-w-4xl lg:max-w-6xl px-4 py-6 space-y-8">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-ink-muted hover:text-ink"><ArrowLeft className="size-5" /></Link>
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold flex items-center gap-2">
            <Brain className="size-5 text-brand-soft" /> Agent Manager
          </h1>
          <p className="text-xs text-ink-muted">Antigravity-style surface: skills, workflows, parallel agents, artifacts.</p>
        </div>
        <Badge tone="brand" className="ml-auto">Live</Badge>
      </header>

      {/* Top: parallel agent grid */}
      <Section title="Agents" hint={`${AGENTS.length} agents running in parallel within the book-service workflow`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {AGENTS.map((a) => {
            const stats = perAgent.get(a.key) ?? { runs: 0, latency_total: 0, latest_rationale: null };
            const avg = stats.runs ? Math.round(stats.latency_total / stats.runs) : 0;
            const idle = stats.runs === 0;
            return (
              <Card key={a.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone={AGENT_TONE[a.key] ?? "default"}>{a.label}</Badge>
                  <span className={`size-2 rounded-full ml-auto ${idle ? "bg-ink-dim" : "bg-accent animate-pulse-soft"}`} />
                </div>
                <p className="text-xs text-ink-muted">{a.role}</p>
                <div className="text-[11px] text-ink-dim flex items-center justify-between font-mono">
                  <span>{stats.runs} runs / 24h</span>
                  <span>{avg}ms avg</span>
                </div>
                {stats.latest_rationale && (
                  <p className="text-[11px] text-ink-muted italic line-clamp-2 border-t border-line pt-2">{stats.latest_rationale}</p>
                )}
                <div className="text-[10px] text-ink-dim flex items-center gap-1">
                  <FileText className="size-3" /> {a.skill}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Skills inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Skills" hint={`${skills.length} loaded from .agent/skills/*/SKILL.md`}>
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-line">
              {skills.map((s) => (
                <li key={s.name} className="p-3 flex items-start gap-3">
                  <Layers className="size-4 text-brand-soft mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-ink">{s.name}</code>
                      <span className="text-[10px] text-ink-dim ml-auto font-mono">{s.body.length} chars</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{s.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section title="Workflows" hint={`${workflows.length} loaded from .agent/workflows/*.md`}>
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y divide-line">
              {workflows.map((w) => (
                <li key={w.name} className="p-3 flex items-start gap-3">
                  <GitBranch className="size-4 text-warn mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-ink">{w.name}</code>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{w.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      </div>

      {/* Recent trace stream */}
      <Section title="Live event stream" hint="Last 60 trace events across all agents" action={
        <Badge tone="default">{traces?.length ?? 0} events</Badge>
      }>
        <Card className="p-0 overflow-hidden">
          <ol className="divide-y divide-line max-h-[480px] overflow-y-auto scrollbar-thin">
            {(traces ?? []).map((t, i) => (
              <li key={i} className="p-3 flex items-start gap-3 text-xs">
                <Activity className="size-3.5 text-ink-dim mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={AGENT_TONE[t.agent as string] ?? "default"}>{t.agent as string}</Badge>
                    <span className="font-medium">{t.step as string}</span>
                    {t.model && <span className="text-[10px] text-ink-dim font-mono">{t.model as string}</span>}
                    {typeof t.confidence === "number" && (
                      <Badge tone={t.confidence >= 0.75 ? "accent" : "warn"}>conf {t.confidence.toFixed(2)}</Badge>
                    )}
                    <span className="ml-auto text-[10px] text-ink-dim font-mono">{t.latency_ms ?? "—"}ms</span>
                  </div>
                  {t.rationale ? (
                    <p className="mt-1 text-ink-muted line-clamp-2">{t.rationale as string}</p>
                  ) : null}
                  {t.booking_id ? (
                    <Link href={`/traces/${t.booking_id}`} className="mt-1 inline-block text-[10px] text-brand-soft hover:underline">
                      view artifact →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
            {(!traces || traces.length === 0) && (
              <li className="p-6 text-center text-sm text-ink-muted">No trace events yet. Submit a request at <Link href="/request" className="text-brand-soft underline">/request</Link>.</li>
            )}
          </ol>
        </Card>
      </Section>

      {/* Artifacts */}
      <Section title="Artifacts" hint="Recent deliverables produced by the agents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(bookings ?? []).map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="contents">
              <Card className="cursor-pointer hover:bg-bg-elev/80 transition">
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-accent" />
                  <Badge tone="accent">{b.status as string}</Badge>
                  <span className="ml-auto text-xs font-mono">PKR {(b.total_price as number)?.toLocaleString?.() ?? "—"}</span>
                </div>
                <p className="text-sm mt-2 line-clamp-2">{b.request_text as string}</p>
                <div className="text-[10px] text-ink-dim mt-2 font-mono">{b.service as string} · {new Date(b.created_at as string).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</div>
              </Card>
            </Link>
          ))}
          {(disputes ?? []).map((d) => (
            <Link key={d.id} href={`/bookings/${d.booking_id}`} className="contents">
              <Card className="cursor-pointer hover:bg-bg-elev/80 transition border-danger/30">
                <div className="flex items-center gap-2">
                  <MessageSquareWarning className="size-4 text-danger" />
                  <Badge tone="danger">{d.case_type as string}</Badge>
                  <Badge tone="default" className="ml-auto">{d.status as string}</Badge>
                </div>
                <p className="text-sm mt-2">decision: <code className="text-ink-muted">{d.decision as string}</code></p>
                <div className="text-[10px] text-ink-dim mt-2 font-mono">refund: PKR {(d.refund_amount as number)?.toLocaleString?.() ?? 0} · {new Date(d.created_at as string).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</div>
              </Card>
            </Link>
          ))}
          {(!bookings || bookings.length === 0) && (!disputes || disputes.length === 0) && (
            <Card className="col-span-full text-center text-sm text-ink-muted py-8">
              No artifacts yet. Run a booking to see the agentic flow produce one.
            </Card>
          )}
        </div>
      </Section>
    </main>
  );
}
