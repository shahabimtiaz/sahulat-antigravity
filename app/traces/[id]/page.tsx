import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/server";
import { ArrowLeft, Brain } from "lucide-react";
import { Badge, Card, Section } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const AGENT_TONE: Record<string, "brand" | "accent" | "warn" | "default" | "danger"> = {
  orchestrator: "brand",
  intent: "accent",
  discovery: "default",
  matcher: "brand",
  pricer: "accent",
  scheduler: "warn",
  booking: "brand",
  notification: "default",
  quality: "accent",
  dispute: "danger",
  fallback: "warn",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAdminSupabase();

  const [{ data: traces }, { data: booking }] = await Promise.all([
    supabase.from("traces").select("*").eq("booking_id", id).order("created_at", { ascending: true }),
    supabase.from("bookings").select("id, service, request_text, status").eq("id", id).single(),
  ]);

  if (!booking) return notFound();

  return (
    <main className="mx-auto w-full max-w-md sm:max-w-3xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href={`/bookings/${id}`} className="text-ink-muted hover:text-ink"><ArrowLeft className="size-5" /></Link>
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Brain className="size-4 text-brand-soft" /> Agent reasoning trace</h1>
          <p className="text-xs text-ink-muted">Antigravity-style artifact for booking {id.slice(0, 8)}…</p>
        </div>
        <Badge tone="brand" className="ml-auto">{traces?.length ?? 0} events</Badge>
      </header>

      <Card>
        <div className="text-xs uppercase tracking-wider text-ink-muted">Original request</div>
        <p className="text-sm mt-1">{booking.request_text}</p>
      </Card>

      <Section title="Timeline" hint="Each step the agentic system took to fulfill this request">
        <ol className="space-y-3">
          {(traces ?? []).map((t) => (
            <li key={t.id}>
              <Card className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={AGENT_TONE[t.agent] ?? "default"}>{t.agent}</Badge>
                  <span className="font-medium text-sm">{t.step}</span>
                  {t.model && <Badge tone="default" className="text-[10px]">{t.model}</Badge>}
                  {typeof t.confidence === "number" && (
                    <Badge tone={t.confidence >= 0.75 ? "accent" : "warn"}>conf {Number(t.confidence).toFixed(2)}</Badge>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-ink-dim">{t.latency_ms ?? "—"}ms</span>
                </div>
                {t.input_summary && (
                  <div className="text-xs">
                    <div className="text-ink-dim uppercase tracking-wider text-[10px] mb-0.5">input</div>
                    <div className="text-ink-muted font-mono break-all line-clamp-2">{t.input_summary}</div>
                  </div>
                )}
                {t.rationale && (
                  <div className="text-xs">
                    <div className="text-ink-dim uppercase tracking-wider text-[10px] mb-0.5">rationale</div>
                    <p className="text-ink">{t.rationale}</p>
                  </div>
                )}
                {t.output && (
                  <details>
                    <summary className="text-xs text-ink-dim cursor-pointer hover:text-ink-muted">output</summary>
                    <pre className="mt-2 text-[11px] font-mono bg-bg-soft border border-line rounded-lg p-3 overflow-x-auto scrollbar-thin">
                      {JSON.stringify(t.output, null, 2)}
                    </pre>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </Section>
    </main>
  );
}
