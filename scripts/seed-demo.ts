/**
 * Demo data seed.
 *
 * Inserts 4 example bookings in varied states + their reasoning traces,
 * so a fresh-clone judge landing on /agents, /traces/[id], or the provider
 * dashboard sees realistic content immediately — even before they submit
 * their first request.
 *
 * Run after `pnpm seed` (which inserts the provider catalog):
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/seed-demo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function isoOffset(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

type BookingSeed = {
  request_text: string;
  service: string;
  complexity_hint: "basic" | "intermediate" | "complex";
  urgency: "low" | "medium" | "high" | "emergency";
  city: string;
  area: string;
  lat: number; lng: number;
  scheduled_offset_h: number;
  status: "confirmed" | "en_route" | "completed" | "disputed";
  total_price: number;
  rating?: number;
  rating_comment?: string;
  sentiment_themes?: string[];
  cancellation_reason?: string;
  proof_photo_urls?: string[];
  // dispute (optional)
  dispute?: {
    raised_by: "user" | "provider";
    case_type: "no_show" | "late_arrival" | "quality" | "price" | "overrun";
    description: string;
    decision: string;
    refund_amount: number;
  };
};

const intentFor = (b: BookingSeed) => ({
  service_type: b.service,
  service_label: b.service.replace("_", " "),
  issue_severity: b.urgency === "emergency" ? "high" : "medium",
  location: { raw: `${b.area}, ${b.city}`, city: b.city, area: b.area, lat: b.lat, lng: b.lng },
  time: { kind: "specific", raw: "demo", iso: isoOffset(b.scheduled_offset_h) },
  urgency: b.urgency,
  price_sensitivity: "medium",
  constraints: [],
  complexity_hint: b.complexity_hint,
  detected_languages: ["ur-Latn", "en"],
  confidence: 0.91,
  clarifying_questions: [],
  rationale: "Demo intent seeded for visualization purposes.",
});

const priceBreakdownFor = (b: BookingSeed) => ({
  currency: "PKR",
  line_items: [
    { label: "Visit fee", amount: 400, kind: "fee" },
    { label: `Service fee (${b.complexity_hint})`, amount: Math.round(b.total_price * 0.65), kind: "fee", note: `Complexity multiplier ${({basic: 1.0, intermediate: 1.4, complex: 1.9})[b.complexity_hint]}` },
    { label: "Distance", amount: 140, kind: "fee", note: "4.0km × 35 PKR" },
    { label: "Platform fee", amount: 50, kind: "fee" },
  ],
  subtotal: b.total_price - 50,
  total: b.total_price,
  fairness: {
    user_view: "Visit + distance are exact costs; service fee scales with complexity.",
    provider_view: "Earnings include base service + distance reimbursement, minus 50 PKR platform fee.",
  },
  rationale: "Transparent line-item breakdown.",
});

const DEMOS: BookingSeed[] = [
  {
    request_text: "AC bilkul kaam nahi kar raha, kal subah G-13 mein technician chahiye.",
    service: "ac_repair",
    complexity_hint: "complex",
    urgency: "high",
    city: "Islamabad", area: "G-13", lat: 33.6489, lng: 72.9763,
    scheduled_offset_h: 18,    // tomorrow morning
    status: "confirmed",
    total_price: 3460,
  },
  {
    request_text: "Plumber chahiye abhi, bathroom mein leak hai I-8 ke andar.",
    service: "plumbing",
    complexity_hint: "intermediate",
    urgency: "emergency",
    city: "Islamabad", area: "I-8", lat: 33.6720, lng: 73.0744,
    scheduled_offset_h: 0.5,
    status: "en_route",
    total_price: 1850,
  },
  {
    request_text: "Math tutor for O-Level, Cantt area Lahore, twice a week.",
    service: "tutoring",
    complexity_hint: "intermediate",
    urgency: "low",
    city: "Lahore", area: "Cantt", lat: 31.5050, lng: 74.3946,
    scheduled_offset_h: -72,   // happened 3 days ago, completed
    status: "completed",
    total_price: 2050,
    rating: 5,
    rating_comment: "Punctual and explained concepts very clearly. Will book again.",
    sentiment_themes: ["punctual", "clear_explanation"],
    proof_photo_urls: ["https://placehold.co/600x400/0a0a0b/10b981?text=Lesson+Notes"],
  },
  {
    request_text: "Bijli ka switch jal gaya hai Gulberg Lahore mein, urgent.",
    service: "electrical",
    complexity_hint: "intermediate",
    urgency: "high",
    city: "Lahore", area: "Gulberg III", lat: 31.5170, lng: 74.3445,
    scheduled_offset_h: -24,
    status: "disputed",
    total_price: 2200,
    rating: 2,
    rating_comment: "Charged extra without explaining, work was rushed.",
    sentiment_themes: ["overcharged", "rushed"],
    proof_photo_urls: ["https://placehold.co/600x400/0a0a0b/ef4444?text=Issue+Photo"],
    dispute: {
      raised_by: "user",
      case_type: "price",
      description: "Final charge was 2200 vs quoted 1750. Provider couldn't justify the difference.",
      decision: "refund_partial",
      refund_amount: 450,
    },
  },
];

async function main() {
  console.log(`Seeding ${DEMOS.length} demo bookings…`);

  // Pick one matching provider per demo.
  for (const d of DEMOS) {
    const { data: provider } = await supabase
      .from("providers")
      .select("id, name")
      .eq("primary_service", d.service)
      .eq("city", d.city)
      .order("on_time_score", { ascending: false })
      .limit(1)
      .single();

    if (!provider) {
      console.warn(`  skip: no ${d.service} provider in ${d.city}`);
      continue;
    }

    const intent = intentFor(d);
    const priceBreakdown = priceBreakdownFor(d);
    const scheduledStart = isoOffset(d.scheduled_offset_h);
    const scheduledEnd = new Date(new Date(scheduledStart).getTime() + 60 * 60_000).toISOString();

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        provider_id: provider.id,
        service: d.service,
        complexity_hint: d.complexity_hint,
        urgency: d.urgency,
        request_text: d.request_text,
        parsed_intent: intent,
        location_raw: `${d.area}, ${d.city}`,
        location_lat: d.lat,
        location_lng: d.lng,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: d.status,
        price_breakdown: priceBreakdown,
        total_price: d.total_price,
        rating: d.rating ?? null,
        rating_comment: d.rating_comment ?? null,
        sentiment_themes: d.sentiment_themes ?? [],
        proof_photo_urls: d.proof_photo_urls ?? [],
        actual_start: d.status === "completed" || d.status === "disputed" ? scheduledStart : null,
        actual_end: d.status === "completed" || d.status === "disputed" ? scheduledEnd : null,
        on_time_delta_min: d.status === "completed" ? 0 : null,
        cancellation_reason: d.cancellation_reason ?? null,
        notification_log: [
          { kind: "sms_user", template: "booking_confirmation", at: isoOffset(d.scheduled_offset_h - 1) },
        ],
      })
      .select("id")
      .single();

    if (error || !booking) {
      console.warn(`  fail [${d.service}]:`, error?.message);
      continue;
    }
    console.log(`  ✓ ${d.service} (${d.status}) → booking ${booking.id.slice(0, 8)} with ${provider.name}`);

    // Insert reasoning traces for this booking — one per agent in the chain.
    const requestId = crypto.randomUUID();
    type TraceRow = {
      agent: string;
      step: string;
      input_summary?: string;
      output?: unknown;
      rationale?: string;
      confidence?: number;
      model?: string;
      latency_ms?: number;
    };
    const traces: TraceRow[] = [
      { agent: "orchestrator", step: "start", input_summary: d.request_text, rationale: "Begin Antigravity book-service workflow.", latency_ms: 1, output: { workflow: "book-service" } },
      { agent: "intent", step: "extract", input_summary: d.request_text, output: intent, rationale: intent.rationale, confidence: 0.91, model: "gemini-2.5-flash", latency_ms: 412 },
      { agent: "discovery", step: "places+seed", input_summary: `service=${d.service}`, output: { live_count: 8, seed_count: 4, merged: 11 }, rationale: "Live Places + Supabase seed merged.", latency_ms: 285 },
      { agent: "matcher", step: "rank", input_summary: `pool=11`, output: { top: provider.name, score: 87 }, rationale: `Ranked 5 of 11. Top: ${provider.name} on specialization + reliability.`, latency_ms: 3 },
      { agent: "pricer", step: "quote", output: priceBreakdown, rationale: `Service ${Math.round(d.total_price * 0.65)} + distance 140 + platform 50.`, latency_ms: 1 },
      { agent: "scheduler", step: "confirmed", output: { slot: { start: scheduledStart, end: scheduledEnd, provider_id: provider.id } }, rationale: "Slot reserved with 20-min travel buffer.", latency_ms: 64 },
      { agent: "booking", step: "confirmed", output: { booking_id: booking.id, total: d.total_price }, rationale: "Booking row inserted; notification log seeded.", latency_ms: 38 },
    ];

    if (d.status === "en_route") {
      traces.push({ agent: "quality", step: "en_route", output: { id: booking.id, status: "en_route" }, rationale: "Provider departed. ETA tracked.", latency_ms: 5 });
    }
    if (d.status === "completed" || d.status === "disputed") {
      traces.push(
        { agent: "quality", step: "in_progress", output: { id: booking.id }, rationale: "Provider arrived on time. Work started.", latency_ms: 2 },
        { agent: "quality", step: "completed", output: { id: booking.id, proof: d.proof_photo_urls }, rationale: "Service completed with proof photo + checklist.", latency_ms: 4 },
      );
      if (d.rating) {
        traces.push({
          agent: "quality",
          step: "review_submitted",
          output: { rating: d.rating, sentiment: { score: d.rating >= 4 ? 0.7 : -0.5, themes: d.sentiment_themes ?? [] } },
          rationale: `Review captured; reputation EWMA updated. ${d.rating <= 2 ? "Negative review flagged for future matching." : "Positive review boosted specialization tags."}`,
          latency_ms: 240,
        });
      }
    }
    if (d.dispute) {
      traces.push({
        agent: "dispute",
        step: d.dispute.case_type,
        input_summary: d.dispute.description,
        output: { decision: d.dispute.decision, refund_amount: d.dispute.refund_amount, reputation_delta: { customer: 0, provider: -2 } },
        rationale: "Charged amount differed from quote; refunding the delta and warning provider.",
        latency_ms: 1,
      });
    }

    await supabase.from("traces").insert(traces.map((t) => ({
      request_id: requestId,
      booking_id: booking.id,
      ...t,
    })));

    if (d.dispute) {
      await supabase.from("disputes").insert({
        booking_id: booking.id,
        raised_by: d.dispute.raised_by,
        case_type: d.dispute.case_type,
        description: d.dispute.description,
        decision: d.dispute.decision,
        refund_amount: d.dispute.refund_amount,
        reputation_delta: { customer: 0, provider: -2 },
        status: "resolved",
        resolved_at: new Date().toISOString(),
      });
    }
  }

  console.log("\nDone. Visit /agents to see live artifacts.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
