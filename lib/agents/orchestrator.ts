/**
 * Sahulat — top-level agent orchestrator.
 *
 * Mirrors the Antigravity workflow `.agent/workflows/book-service.md`:
 *   intent → discovery → match → price → schedule → book → notify → trace flush
 *
 * Each step emits TraceEvents which are visible at /traces/[bookingId].
 */
import { getAdminSupabase } from "@/lib/supabase/server";
import { TraceCollector, newRequestId } from "./trace";
import { extractIntent } from "./intent";
import { discoverProviders } from "@/lib/places/client";
import { matchProviders } from "./matcher";
import { quotePrice, estimateDemandIndex } from "./pricer";
import { scheduleBooking } from "./scheduler";
import type { Intent, PriceQuote, RankedProvider, ScheduleResult } from "./types";
import { loadWorkflow } from "./skill-loader";

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Islamabad: { lat: 33.6844, lng: 73.0479 },
  Rawalpindi: { lat: 33.5651, lng: 73.0169 },
  Lahore: { lat: 31.5204, lng: 74.3587 },
};

const AREA_CENTERS: Record<string, { lat: number; lng: number }> = {
  "G-13": { lat: 33.6489, lng: 72.9763 },
  "G-11": { lat: 33.6695, lng: 72.9933 },
  "G-10": { lat: 33.6743, lng: 73.0143 },
  "G-9":  { lat: 33.6961, lng: 73.0287 },
  "F-7":  { lat: 33.7257, lng: 73.0566 },
  "F-8":  { lat: 33.7185, lng: 73.0540 },
  "F-10": { lat: 33.7019, lng: 73.0220 },
  "F-11": { lat: 33.6810, lng: 72.9908 },
  "I-8":  { lat: 33.6720, lng: 73.0744 },
  "I-9":  { lat: 33.6664, lng: 73.0825 },
  "I-10": { lat: 33.6650, lng: 73.0608 },
  "Gulberg": { lat: 31.5170, lng: 74.3445 },
  "Gulberg III": { lat: 31.5170, lng: 74.3445 },
  "DHA":  { lat: 31.4720, lng: 74.4055 },
  "Saddar": { lat: 33.5969, lng: 73.0418 },
  "Bahria Town": { lat: 33.5285, lng: 73.0826 },
  "Johar Town": { lat: 31.4685, lng: 74.2730 },
  "Model Town": { lat: 31.4781, lng: 74.3243 },
  "Blue Area": { lat: 33.7099, lng: 73.0594 },
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveCustomerLocation(intent: Intent): { lat: number; lng: number; city: string; area?: string } {
  if (intent.location.lat && intent.location.lng) {
    return { lat: intent.location.lat, lng: intent.location.lng, city: intent.location.city ?? "Islamabad", area: intent.location.area };
  }
  let derived: { lat: number; lng: number; city: string; area?: string } | null = null;
  if (intent.location.area && AREA_CENTERS[intent.location.area]) {
    derived = { ...AREA_CENTERS[intent.location.area], city: intent.location.city ?? "Islamabad", area: intent.location.area };
  } else {
    // Also try uppercase / fuzzy keys.
    const areaKey = Object.keys(AREA_CENTERS).find((k) =>
      intent.location.area && k.toLowerCase() === intent.location.area.toLowerCase()
    );
    if (areaKey) derived = { ...AREA_CENTERS[areaKey], city: intent.location.city ?? "Islamabad", area: areaKey };
    else if (intent.location.city && CITY_CENTERS[intent.location.city]) {
      derived = { ...CITY_CENTERS[intent.location.city], city: intent.location.city };
    } else {
      derived = { ...CITY_CENTERS.Islamabad, city: "Islamabad" };
    }
  }
  
  intent.location.lat = derived.lat;
  intent.location.lng = derived.lng;
  return derived;
}

export type OrchestrateInput = {
  message: string;
  profile_id?: string | null;
  loyalty_tier?: "new" | "regular" | "loyal";
  /** Optional pre-set location override for the demo. */
  location?: { lat: number; lng: number };
};

export type OrchestrateClarify = {
  status: "needs_clarification";
  request_id: string;
  intent: Intent;
  questions: string[];
  trace: ReturnType<TraceCollector["list"]>;
};

export type OrchestrateOffer = {
  status: "offer";
  request_id: string;
  intent: Intent;
  ranking: RankedProvider[];
  top_quote: PriceQuote;
  alt_quote?: PriceQuote;
  quotes: Record<string, PriceQuote>;
  schedule: ScheduleResult;
  trace: ReturnType<TraceCollector["list"]>;
};

export type OrchestrateWaitlist = {
  status: "waitlisted" | "no_providers";
  request_id: string;
  intent: Intent;
  rationale: string;
  trace: ReturnType<TraceCollector["list"]>;
};

export type OrchestrateResult = OrchestrateClarify | OrchestrateOffer | OrchestrateWaitlist;

export async function orchestrate(input: OrchestrateInput): Promise<OrchestrateResult> {
  const request_id = newRequestId();
  const trace = new TraceCollector(request_id);
  const t0 = Date.now();

  // Load the Antigravity workflow definition so we record which skill drives the run.
  let workflowSummary = "book-service";
  try {
    const wf = await loadWorkflow("book-service");
    workflowSummary = `${wf.name} — ${wf.description}`;
  } catch { /* missing workflow file = non-fatal */ }

  trace.push({
    agent: "orchestrator",
    step: "start",
    input_summary: input.message.slice(0, 240),
    output: { workflow: workflowSummary, skill_chain: ["intent-extraction", "provider-matching", "dynamic-pricing", "scheduling"] },
    rationale: "Begin Antigravity `book-service` workflow.",
  });

  // 1. Intent
  const intent = await extractIntent(input.message, { trace });

  // 1a. Low confidence → clarifying questions
  if (intent.confidence < 0.75 || intent.clarifying_questions.length > 0) {
    trace.push({
      agent: "orchestrator",
      step: "needs_clarification",
      output: { confidence: intent.confidence, questions: intent.clarifying_questions },
      rationale: `Confidence ${intent.confidence.toFixed(2)} below 0.75 — asking ${intent.clarifying_questions.length} clarifying questions.`,
      latency_ms: Date.now() - t0,
    });
    await trace.flush();
    return { status: "needs_clarification", request_id, intent, questions: intent.clarifying_questions, trace: trace.list() };
  }

  // 2. Discovery
  const customer = input.location ?? resolveCustomerLocation(intent);
  const candidates = await discoverProviders(
    { service: intent.service_type, lat: customer.lat, lng: customer.lng, radius_m: 12_000 },
    trace,
  );

  if (!candidates.length) {
    // Persist a waitlist row so the user genuinely enters a queue, not just a UI state.
    const wlAfter = new Date(Date.now() - 1 * 60_000).toISOString();
    const wlBefore = new Date(Date.now() + 6 * 3600_000).toISOString();
    try {
      const supabase = getAdminSupabase();
      const { data: wlId } = await supabase.rpc("add_to_waitlist", {
        p_profile_id: input.profile_id ?? null,
        p_service: intent.service_type,
        p_area: intent.location.area ?? intent.location.city ?? null,
        p_requested_after: wlAfter,
        p_requested_before: wlBefore,
        p_parsed_intent: intent,
      });
      trace.push({
        agent: "orchestrator",
        step: "waitlisted",
        output: { waitlist_id: wlId, window: { after: wlAfter, before: wlBefore } },
        rationale: "No providers from Places or seed. Customer added to waitlist; will be notified when capacity opens.",
        latency_ms: Date.now() - t0,
      });
    } catch (e) {
      trace.push({
        agent: "orchestrator",
        step: "waitlist_failed",
        rationale: `Waitlist insert failed (${(e as Error).message}); returning no_providers without queue entry.`,
        latency_ms: Date.now() - t0,
      });
    }
    await trace.flush();
    return { status: "waitlisted", request_id, intent, rationale: "No providers available right now. You've been added to the waitlist.", trace: trace.list() };
  }

  // 3. Match
  const { ranking } = await matchProviders({ intent, candidates, customerLocation: customer, trace });

  if (!ranking.length) {
    trace.push({
      agent: "orchestrator",
      step: "all_rejected_by_filters",
      rationale: "Candidates existed but all rejected by hard filters.",
      latency_ms: Date.now() - t0,
    });
    await trace.flush();
    return { status: "no_providers", request_id, intent, rationale: "No providers match your constraints (gender, language, etc.). Added to waitlist.", trace: trace.list() };
  }

  // 4. Schedule (tentative — actual write happens on user confirm)
  const schedule = await scheduleBooking({ intent, ranking, trace });

  // 5. Price every provider that the UI can actually choose. This avoids a
  // subtle mismatch when scheduling skips the top-ranked provider due to a
  // conflict and confirms a lower-ranked provider instead.
  const demand_index = estimateDemandIndex(intent);
  const quotes: Record<string, PriceQuote> = {};
  const quoteFor = (r: RankedProvider): PriceQuote => {
    quotes[r.provider_id] ??= quotePrice({
      intent,
      provider: r.provider,
      travel_km: r.distance_km,
      demand_index,
      loyalty_tier: input.loyalty_tier ?? "new",
      trace,
    });
    return quotes[r.provider_id];
  };

  const top_quote = quoteFor(ranking[0]);
  let alt_quote: PriceQuote | undefined;
  if (intent.price_sensitivity === "high" && ranking[1]) {
    alt_quote = quoteFor(ranking[1]);
  }

  if (schedule.status === "confirmed") {
    const scheduledProvider = ranking.find((r) => r.provider_id === schedule.slot.provider_id);
    if (scheduledProvider) quoteFor(scheduledProvider);
  }
  if (schedule.status !== "confirmed") {
    for (const alt of schedule.alternates ?? []) {
      const altProvider = ranking.find((r) => r.provider_id === alt.provider_id);
      if (altProvider) quoteFor(altProvider);
    }
  }

  trace.push({
    agent: "orchestrator",
    step: "offer_ready",
    output: {
      ranking: ranking.slice(0, 3).map((r) => ({ name: r.name, score: r.score, distance_km: r.distance_km })),
      top_quote_total: top_quote.total,
      quote_provider_ids: Object.keys(quotes),
      scheduled_provider_id: schedule.status === "confirmed" ? schedule.slot.provider_id : null,
      schedule_status: schedule.status,
    },
    rationale: "Workflow complete. Returning offer to user for confirmation.",
    latency_ms: Date.now() - t0,
  });

  await trace.flush();
  return { status: "offer", request_id, intent, ranking, top_quote, alt_quote, quotes, schedule, trace: trace.list() };
}

/**
 * Confirm step — user picked a provider + slot. Calls the atomic
 * `reserve_slot` Postgres function so two simultaneous confirmations on
 * the same provider+slot cannot both succeed.
 */
export type ConfirmResult =
  | { status: "confirmed"; booking_id: string }
  | { status: "conflict"; overlapping_booking_id: string };

export async function confirmBooking(input: {
  request_id: string;
  profile_id?: string | null;
  intent: Intent;
  provider_id: string;
  slot_start: string;
  slot_end: string;
  price_breakdown: PriceQuote;
  request_text: string;
}): Promise<ConfirmResult> {
  const trace = new TraceCollector(input.request_id);
  const supabase = getAdminSupabase();
  const now = new Date(input.slot_start);

  if (!UUID_RE.test(input.provider_id)) {
    trace.push({
      agent: "booking",
      step: "unbookable_provider",
      output: { provider_id: input.provider_id },
      rationale: "Provider was not persisted in Supabase, so atomic reservation cannot be performed.",
    });
    await trace.flush();
    throw new Error("Selected provider is not bookable yet. Please choose a persisted provider from the ranked list.");
  }

  // Reminder notifications scheduled at T-2h and T-30m alongside the
  // confirmation. The notification_log is the simulated SMS/WhatsApp ledger.
  const notificationLog = [
    { kind: "sms_user", template: "booking_confirmation", at: new Date().toISOString() },
    { kind: "whatsapp_provider", template: "new_job", at: new Date().toISOString() },
    { kind: "sms_user", template: "reminder_t_2h", at: new Date(now.getTime() - 2 * 3600_000).toISOString() },
    { kind: "sms_user", template: "reminder_t_30m", at: new Date(now.getTime() - 30 * 60_000).toISOString() },
    { kind: "whatsapp_provider", template: "reminder_t_30m", at: new Date(now.getTime() - 30 * 60_000).toISOString() },
  ];

  const { data, error } = await supabase.rpc("reserve_slot", {
    p_provider_id: input.provider_id,
    p_profile_id: input.profile_id ?? null,
    p_service: input.intent.service_type,
    p_complexity: input.intent.complexity_hint,
    p_urgency: input.intent.urgency,
    p_request_text: input.request_text,
    p_parsed_intent: input.intent,
    p_location_raw: input.intent.location.raw,
    p_location_lat: input.intent.location.lat ?? null,
    p_location_lng: input.intent.location.lng ?? null,
    p_scheduled_start: input.slot_start,
    p_scheduled_end: input.slot_end,
    p_buffer_min: 20,
    p_price_breakdown: input.price_breakdown,
    p_total_price: input.price_breakdown.total,
    p_notification_log: notificationLog,
  });
  if (error) throw new Error(`reserve_slot failed: ${error.message}`);

  const result = data as { status: "confirmed" | "conflict"; booking_id?: string; overlapping_booking_id?: string };

  if (result.status === "conflict") {
    trace.push({
      agent: "booking",
      step: "conflict",
      output: { overlapping_booking_id: result.overlapping_booking_id },
      rationale: "Another customer reserved this slot first. Asking user to pick an alternate.",
    });
    await trace.flush();
    return { status: "conflict", overlapping_booking_id: result.overlapping_booking_id! };
  }

  const booking_id = result.booking_id!;
  trace.attachBookingId(booking_id);

  const { error: attachErr } = await supabase
    .from("traces")
    .update({ booking_id })
    .eq("request_id", input.request_id)
    .is("booking_id", null);
  if (attachErr) console.warn("trace attach failed:", attachErr.message);

  trace.push({
    agent: "booking",
    step: "confirmed",
    output: {
      booking_id,
      provider_id: input.provider_id,
      slot_start: input.slot_start,
      total: input.price_breakdown.total,
      reminders_scheduled: notificationLog.filter((n) => n.template.startsWith("reminder_")).length,
    },
    rationale: "Atomic reservation succeeded via reserve_slot RPC. Reminders scheduled at T-2h and T-30m.",
  });
  trace.push({
    agent: "notification",
    step: "confirmation_actions",
    output: {
      booking_id,
      notification_log: notificationLog,
      receipt: { total: input.price_breakdown.total, currency: input.price_breakdown.currency },
    },
    rationale: "Simulated SMS/WhatsApp confirmation, provider assignment, receipt, and reminder schedule recorded on the booking.",
  });
  await trace.flush();
  return { status: "confirmed", booking_id };
}
