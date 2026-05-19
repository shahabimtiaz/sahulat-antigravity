"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, Section, StatBar } from "@/components/ui/primitives";
import {
  ArrowLeft, ArrowRight, Brain, Clock, Languages, MapPin, Receipt,
  Send, Sparkles, Star, Wrench, Loader2, ShieldAlert, ChevronRight, AlertTriangle,
} from "lucide-react";

type OrchestrateResult = {
  status: "needs_clarification" | "offer" | "waitlisted" | "no_providers";
  request_id: string;
  intent: Record<string, any>;
  questions?: string[];
  ranking?: any[];
  top_quote?: any;
  alt_quote?: any;
  quotes?: Record<string, any>;
  schedule?: any;
  rationale?: string;
  trace: any[];
};

export default function RequestClient() {
  const search = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState(search.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ providerId: string; slot: { start: string; end: string }; quote: any } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const q = search.get("q");
    if (q && !result && !loading) {
      setMessage(q);
    }
  }, [search, result, loading]);

  async function submit() {
    if (!message.trim() || loading) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const r = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "request failed");
      setResult(json);
      // Auto-pick top provider when offer returned.
      if (json.status === "offer" && json.ranking?.length && json.schedule?.status === "confirmed") {
        const selectedProviderId = json.schedule.slot.provider_id;
        setPicked({
          providerId: selectedProviderId,
          slot: { start: json.schedule.slot.start, end: json.schedule.slot.end },
          quote: json.quotes?.[selectedProviderId] ?? json.top_quote,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!result || !picked || !result.intent) return;
    setConfirming(true);
    try {
      const r = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: result.request_id,
          intent: result.intent,
          provider_id: picked.providerId,
          slot_start: picked.slot.start,
          slot_end: picked.slot.end,
          price_breakdown: picked.quote,
          request_text: message,
        }),
      });
      const json = await r.json();
      if (r.status === 409 && json.status === "conflict") {
        setError("Another customer just reserved that slot. Please choose one of the alternate providers or rerun the request.");
        return;
      }
      if (!r.ok) throw new Error(json.error ?? "Booking failed");
      router.push(`/bookings/${json.booking_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-3xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-ink-muted hover:text-ink"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-semibold">New service request</h1>
        <Badge tone="brand" className="ml-auto"><Sparkles className="size-3" /> Antigravity</Badge>
      </header>

      <Card className="space-y-3">
        <label className="text-xs uppercase tracking-wider font-semibold text-ink-muted">
          Describe what you need
        </label>
        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="e.g. AC bilkul kaam nahi kar raha, kal subah G-13 mein..."
          className="w-full resize-none rounded-xl bg-bg-elev border border-line px-3 py-2.5 text-ink placeholder:text-ink-dim outline-none focus:border-brand transition"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-dim">Urdu, Roman Urdu & English supported</span>
          <Button onClick={submit} disabled={loading || !message.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {loading ? "Thinking…" : "Send"}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-danger/40 bg-danger/5">
          <div className="flex items-start gap-2 text-sm text-danger">
            <AlertTriangle className="size-4 mt-0.5" />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {result?.trace?.some((t: { agent: string }) => t.agent === "fallback") && (
        <Card className="border-warn/40 bg-warn/5">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="size-4 mt-0.5 text-warn" />
            <div>
              <div className="font-medium text-warn">Robustness fallback active</div>
              <div className="text-ink-muted text-xs mt-0.5">
                {result.trace.find((t: { agent: string; rationale?: string }) => t.agent === "fallback")?.rationale
                  ?? "An LLM step degraded to rule-based extraction. Workflow completed end-to-end."}
              </div>
            </div>
          </div>
        </Card>
      )}

      {result && <ResultPanel result={result} picked={picked} setPicked={setPicked} />}

      {result?.status === "offer" && picked && (
        <Card className="sticky bottom-3 ring-2 ring-brand/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-ink-muted">Confirm total</div>
              <div className="text-xl font-semibold">PKR {picked.quote.total.toLocaleString()}</div>
            </div>
            <Button onClick={confirm} disabled={confirming}>
              {confirming ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {confirming ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}

function ResultPanel({
  result, picked, setPicked,
}: {
  result: OrchestrateResult;
  picked: { providerId: string; slot: { start: string; end: string }; quote: any } | null;
  setPicked: (p: { providerId: string; slot: { start: string; end: string }; quote: any } | null) => void;
}) {
  if (result.status === "needs_clarification") {
    return (
      <Card className="space-y-3 border-warn/30">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-warn" />
          <h3 className="font-medium">A couple of clarifications</h3>
          <Badge tone="warn" className="ml-auto">conf {Number(result.intent.confidence).toFixed(2)}</Badge>
        </div>
        <ul className="space-y-2">
          {result.questions?.map((q, i) => (
            <li key={i} className="text-sm bg-bg-elev rounded-lg px-3 py-2">{q}</li>
          ))}
        </ul>
      </Card>
    );
  }
  if (result.status === "no_providers" || result.status === "waitlisted") {
    return (
      <Card className="space-y-3 border-warn/30">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warn" />
          <h3 className="font-medium">No provider available</h3>
        </div>
        <p className="text-sm text-ink-muted">{result.rationale ?? "We'll alert you as soon as someone is free."}</p>
      </Card>
    );
  }
  if (result.status !== "offer") return null;

  return (
    <div className="space-y-6">
      <IntentCard intent={result.intent} />
      <ProvidersList
        ranking={result.ranking ?? []}
        topQuote={result.top_quote}
        altQuote={result.alt_quote}
        quotes={result.quotes ?? {}}
        schedule={result.schedule}
        picked={picked}
        setPicked={setPicked}
      />
      <Section title="Trace" hint="What each agent thought along the way" action={
        <span className="text-xs text-ink-dim">{result.trace?.length ?? 0} events</span>
      }>
        <TraceMini trace={result.trace ?? []} />
      </Section>
    </div>
  );
}

function IntentCard({ intent }: { intent: any }) {
  return (
    <Section title="Understanding" hint="What the intent agent extracted">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="brand"><Wrench className="size-3" /> {intent.service_label ?? intent.service_type}</Badge>
          <Badge tone={intent.urgency === "emergency" ? "danger" : intent.urgency === "high" ? "warn" : "default"}>
            <Clock className="size-3" /> {intent.time?.kind?.replace("_", " ")} · {intent.urgency}
          </Badge>
          <Badge tone="default"><MapPin className="size-3" /> {intent.location?.area ?? intent.location?.city ?? intent.location?.raw}</Badge>
          <Badge tone="default"><Languages className="size-3" /> {intent.detected_languages?.join(" · ")}</Badge>
          <Badge tone="accent">complexity: {intent.complexity_hint}</Badge>
          <Badge tone={intent.price_sensitivity === "high" ? "warn" : "default"}>
            price-sensitivity: {intent.price_sensitivity}
          </Badge>
          <span className="ml-auto text-xs text-ink-dim">confidence {Number(intent.confidence).toFixed(2)}</span>
        </div>
        <p className="text-sm text-ink-muted italic">{intent.rationale}</p>
      </Card>
    </Section>
  );
}

function ProvidersList({
  ranking, topQuote, altQuote, quotes, schedule, picked, setPicked,
}: {
  ranking: any[];
  topQuote: any;
  altQuote?: any;
  quotes: Record<string, any>;
  schedule: any;
  picked: { providerId: string; slot: { start: string; end: string }; quote: any } | null;
  setPicked: (p: { providerId: string; slot: { start: string; end: string }; quote: any } | null) => void;
}) {
  if (!ranking.length) return null;
  return (
    <Section title="Top matches" hint={`${ranking.length} ranked from a multi-factor score`}>
      <div className="space-y-3">
        {ranking.map((r, i) => {
          const isPicked = picked?.providerId === r.provider_id;
          const quote = quotes[r.provider_id] ?? (i === 0 ? topQuote : (i === 1 ? altQuote : undefined));
          const confirmedSlot = schedule?.status === "confirmed" ? schedule.slot : undefined;
          const slot = confirmedSlot?.provider_id === r.provider_id
            ? confirmedSlot
            : schedule?.alternates?.find((a: any) => a.provider_id === r.provider_id);
          return (
            <Card
              key={r.provider_id}
              className={`cursor-pointer transition ${isPicked ? "ring-2 ring-brand" : "hover:bg-bg-elev/80"}`}
              onClick={() => quote && slot && setPicked({ providerId: r.provider_id, slot, quote })}
            >
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center text-sm font-semibold text-brand-soft shrink-0">
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium truncate">{r.name}</h4>
                    <Badge tone="accent" className="ml-auto">{r.score.toFixed(0)} score</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-muted">
                    <span className="flex items-center gap-1"><Star className="size-3" /> {r.provider.rating_avg.toFixed(1)} ({r.provider.rating_count})</span>
                    <span>{r.distance_km}km</span>
                    <span>on-time {(r.provider.on_time_score * 100).toFixed(0)}%</span>
                    <span className="capitalize">{r.provider.specialization_level}</span>
                  </div>
                  <p className="text-sm text-ink-muted">{r.why}</p>
                  {r.flags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {r.flags.map((f: string) => (
                        <Badge key={f} tone={f.includes("negative") || f.includes("cancel") ? "warn" : "default"}>
                          {f.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <details className="mt-3 group">
                <summary className="text-xs text-ink-dim cursor-pointer hover:text-ink-muted flex items-center gap-1">
                  Factor breakdown <ChevronRight className="size-3 group-open:rotate-90 transition" />
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(r.breakdown as Record<string, { raw: number; weighted: number }>).map(([k, v]) => (
                    <StatBar key={k} label={k.replaceAll("_", " ")} value={v.raw} tone="brand" />
                  ))}
                </div>
              </details>

              {quote && (
                <div className="mt-4 rounded-xl bg-bg-soft p-3 border border-line space-y-2">
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Receipt className="size-3.5" />
                    <span className="uppercase tracking-wider font-semibold">Quote</span>
                    <span className="ml-auto font-mono text-ink">PKR {quote.total.toLocaleString()}</span>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {quote.line_items.map((li: any, idx: number) => (
                      <li key={idx} className="flex justify-between">
                        <span className="text-ink-muted">{li.label}{li.note ? <span className="text-ink-dim"> — {li.note}</span> : null}</span>
                        <span className={`font-mono ${li.amount < 0 ? "text-accent" : "text-ink"}`}>
                          {li.amount < 0 ? "−" : ""}PKR {Math.abs(li.amount).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {quote.budget_friendly_alternative && (
                    <div className="text-xs text-accent border-t border-line pt-2 mt-2">
                      💡 Budget option: PKR {quote.budget_friendly_alternative.total.toLocaleString()} — {quote.budget_friendly_alternative.swap}
                    </div>
                  )}
                </div>
              )}

              {slot && (
                <div className="mt-2 text-xs text-ink-muted flex items-center gap-1">
                  <Clock className="size-3" />
                  Slot: {new Date(slot.start).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function TraceMini({ trace }: { trace: any[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <ol className="divide-y divide-line">
        {trace.map((t, i) => (
          <li key={i} className="p-3 text-xs flex items-start gap-3">
            <div className="font-mono w-12 shrink-0 text-ink-dim">{t.latency_ms ? `${t.latency_ms}ms` : ""}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge tone="brand">{t.agent}</Badge>
                <span className="font-medium">{t.step}</span>
                {t.confidence !== undefined && t.confidence !== null && (
                  <Badge tone="default">conf {Number(t.confidence).toFixed(2)}</Badge>
                )}
              </div>
              {t.rationale && <p className="text-ink-muted mt-1 line-clamp-2">{t.rationale}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
