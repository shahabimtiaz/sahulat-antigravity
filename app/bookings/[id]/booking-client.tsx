"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Section, StatBar } from "@/components/ui/primitives";
import {
  Clock, MapPin, Phone, CheckCircle2, Truck, AlertTriangle,
  Camera, Star, Receipt, Sparkles, Loader2, RefreshCw, MessageSquareWarning,
} from "lucide-react";

const STATUS_FLOW = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "en_route", label: "En route", icon: Truck },
  { key: "in_progress", label: "In progress", icon: Sparkles },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

type BookingRow = {
  id: string;
  status: string;
  service: string;
  request_text: string;
  scheduled_start: string;
  scheduled_end: string;
  total_price: number;
  price_breakdown: { line_items: Array<{ label: string; amount: number; kind: string; note?: string }>; total: number; fairness?: { user_view: string; provider_view: string }; rationale?: string };
  parsed_intent: { urgency: string; location: { raw: string; city?: string; area?: string }; complexity_hint: string };
  proof_photo_urls: string[];
  rating: number | null;
  rating_comment: string | null;
  cancellation_reason: string | null;
  providers: { id: string; name: string; phone: string | null; area: string | null; city: string; rating_avg: number; languages: string[]; gender: string | null };
};

export default function BookingClient({ booking }: { booking: Record<string, unknown> }) {
  const b = booking as unknown as BookingRow;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(!!b.rating);
  const [disputeOpen, setDisputeOpen] = useState(false);

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    setBusy(status);
    try {
      const r = await fetch(`/api/bookings/${b.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      router.refresh();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }

  async function submitReview() {
    if (!rating) return;
    setBusy("review");
    try {
      const r = await fetch(`/api/bookings/${b.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setReviewed(true);
      router.refresh();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }

  async function triggerReschedule() {
    setBusy("reschedule");
    try {
      await fetch(`/api/bookings/${b.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled_by_provider", reason: "demo simulation" }),
      });
      const r = await fetch(`/api/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: b.id }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }

  const currentStepIdx = STATUS_FLOW.findIndex((s) => s.key === b.status);

  return (
    <div className="space-y-6">
      {/* Provider card */}
      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-brand/10 ring-1 ring-brand/20 flex items-center justify-center text-brand-soft">
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{b.providers?.name}</div>
            <div className="text-xs text-ink-muted flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1"><Star className="size-3" /> {b.providers?.rating_avg?.toFixed(1)}</span>
              <span className="flex items-center gap-1"><MapPin className="size-3" /> {b.providers?.area ?? b.providers?.city}</span>
              {b.providers?.gender && <Badge tone="default">{b.providers.gender}</Badge>}
            </div>
          </div>
          <a href={`tel:${b.providers?.phone ?? ""}`}>
            <Button variant="secondary" size="sm"><Phone className="size-3.5" /> Call</Button>
          </a>
        </div>
        <div className="border-t border-line pt-3 text-sm space-y-1">
          <div className="flex items-center gap-2"><Clock className="size-3.5 text-ink-muted" /><span>{new Date(b.scheduled_start).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span></div>
          <div className="flex items-center gap-2"><MapPin className="size-3.5 text-ink-muted" /><span>{b.parsed_intent?.location?.area ?? b.parsed_intent?.location?.city}</span></div>
        </div>
      </Card>

      {/* Status flow */}
      <Section title="Service progress" hint="Tracking from confirmation to completion">
        <Card className="p-4">
          <ol className="grid grid-cols-4 gap-2">
            {STATUS_FLOW.map((s, i) => {
              const done = i <= currentStepIdx;
              const Icon = s.icon;
              return (
                <li key={s.key} className="text-center space-y-1">
                  <div className={`mx-auto size-9 rounded-full grid place-items-center transition ${done ? "bg-brand text-white" : "bg-bg-elev text-ink-dim border border-line"}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className={`text-[10px] uppercase tracking-wider ${done ? "text-ink" : "text-ink-dim"}`}>{s.label}</div>
                </li>
              );
            })}
          </ol>
          {/* Simulation buttons (demo) */}
          {b.status === "confirmed" && (
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" variant="secondary" onClick={() => setStatus("en_route")} disabled={!!busy}>
                {busy === "en_route" ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />} Provider en route
              </Button>
              <Button size="sm" variant="ghost" onClick={triggerReschedule} disabled={!!busy}>
                {busy === "reschedule" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Simulate provider cancellation
              </Button>
            </div>
          )}
          {b.status === "en_route" && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => setStatus("in_progress")} disabled={!!busy}>
              {busy === "in_progress" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Mark arrived & in progress
            </Button>
          )}
          {b.status === "in_progress" && (
            <div className="space-y-2 mt-4">
              <Button size="sm" variant="primary" onClick={() => setStatus("completed", {
                proof_photo_urls: ["https://placehold.co/600x400/0a0a0b/7c5cff?text=Service+Proof"],
                completion_checklist: { filter_cleaned: true, gas_pressure_ok: true, drain_test: true },
              })} disabled={!!busy}>
                {busy === "completed" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} Complete with proof photo
              </Button>
            </div>
          )}
        </Card>
      </Section>

      {/* Price breakdown */}
      <Section title="Quote breakdown" hint="Transparent line items">
        <Card className="p-4 space-y-2">
          <ul className="space-y-1 text-sm">
            {b.price_breakdown?.line_items?.map((li, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-ink">{li.label}</div>
                  {li.note && <div className="text-xs text-ink-dim">{li.note}</div>}
                </div>
                <div className={`font-mono ${li.amount < 0 ? "text-accent" : ""}`}>
                  {li.amount < 0 ? "−" : ""}PKR {Math.abs(li.amount).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-2 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">PKR {b.total_price?.toLocaleString()}</span>
          </div>
          {b.price_breakdown?.fairness && (
            <div className="text-xs text-ink-muted border-t border-line pt-2 space-y-1">
              <div><strong className="text-ink">Why this is fair to you:</strong> {b.price_breakdown.fairness.user_view}</div>
              <div><strong className="text-ink">Why this is fair to provider:</strong> {b.price_breakdown.fairness.provider_view}</div>
            </div>
          )}
        </Card>
      </Section>

      {/* Proof photos */}
      {b.proof_photo_urls?.length > 0 && (
        <Section title="Proof of work">
          <Card className="grid grid-cols-2 gap-2">
            {b.proof_photo_urls.map((url, idx) => (
              <img key={idx} src={url} alt={`proof ${idx}`} className="rounded-lg w-full object-cover" />
            ))}
          </Card>
        </Section>
      )}

      {/* Review */}
      {b.status === "completed" && !reviewed && (
        <Section title="Rate the service">
          <Card className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="p-1">
                  <Star className={`size-7 ${n <= rating ? "fill-warn text-warn" : "text-ink-dim"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Optional comment…"
              className="w-full rounded-xl bg-bg-elev border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <Button onClick={submitReview} disabled={!rating || !!busy}>
              {busy === "review" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Submit review
            </Button>
          </Card>
        </Section>
      )}

      {/* Submitted review */}
      {reviewed && (
        <Section title="Your review">
          <Card className="space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`size-5 ${n <= (b.rating ?? rating) ? "fill-warn text-warn" : "text-ink-dim"}`} />
              ))}
            </div>
            {(b.rating_comment ?? comment) && <p className="text-sm text-ink-muted">{b.rating_comment ?? comment}</p>}
          </Card>
        </Section>
      )}

      {/* Dispute */}
      {(b.status === "completed" || b.status === "in_progress") && (
        <Section title="Issue with the service?">
          {!disputeOpen ? (
            <Button variant="secondary" size="sm" onClick={() => setDisputeOpen(true)}>
              <MessageSquareWarning className="size-4" /> File a dispute
            </Button>
          ) : (
            <DisputeForm bookingId={b.id} onClose={() => setDisputeOpen(false)} onDone={() => router.refresh()} />
          )}
        </Section>
      )}

      {b.cancellation_reason && (
        <Card className="border-warn/30">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="size-4 text-warn mt-0.5" />
            <span><strong className="text-ink">Note:</strong> {b.cancellation_reason}</span>
          </div>
        </Card>
      )}
    </div>
  );
}

function DisputeForm({ bookingId, onClose, onDone }: { bookingId: string; onClose: () => void; onDone: () => void }) {
  const [caseType, setCaseType] = useState<"no_show" | "late_arrival" | "quality" | "price" | "overrun">("quality");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<unknown>(null);

  async function submit() {
    setSubmitting(true);
    try {
      const r = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, raised_by: "user", case_type: caseType, description }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setDecision(json.decision);
      onDone();
    } catch (e) { alert((e as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Card className="space-y-3 border-danger/30">
      <select value={caseType} onChange={(e) => setCaseType(e.target.value as never)} className="w-full bg-bg-elev border border-line rounded-xl px-3 py-2 text-sm">
        <option value="quality">Quality issue</option>
        <option value="no_show">Provider didn't arrive</option>
        <option value="late_arrival">Arrived very late</option>
        <option value="price">Price differs from quote</option>
        <option value="overrun">Service overran</option>
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="What happened?"
        className="w-full rounded-xl bg-bg-elev border border-line px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={submitting} variant="danger" size="sm">
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquareWarning className="size-3.5" />} Submit dispute
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
      {decision != null && (
        <div className="text-xs text-ink-muted bg-bg-soft rounded-lg p-3 border border-line">
          <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(decision, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
}
