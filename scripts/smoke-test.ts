/**
 * Smoke test for the deterministic agents (matcher + pricer + dispute).
 * Does NOT require Gemini or Supabase — runs purely in-memory with seedProviders.
 *
 * Run:
 *   pnpm tsx scripts/smoke-test.ts
 */
import { matchProviders } from "../lib/agents/matcher";
import { quotePrice, estimateDemandIndex } from "../lib/agents/pricer";
import { resolveDispute } from "../lib/agents/dispute";
import { TraceCollector } from "../lib/agents/trace";
import { seedProviders } from "../data/seed-providers";
import type { Intent, ProviderRow } from "../lib/agents/types";

function asProviderRows(): ProviderRow[] {
  return seedProviders.map((p, i) => ({
    id: `seed_${i}`,
    name: p.name,
    primary_service: p.primary_service,
    skills: p.skills,
    specialization_level: p.specialization_level,
    certifications: p.certifications,
    city: p.city,
    area: p.area,
    lat: p.lat,
    lng: p.lng,
    rating_avg: p.rating_avg,
    rating_count: p.rating_count,
    recent_negative_review_count: p.recent_negative_review_count,
    on_time_score: p.on_time_score,
    cancel_rate: p.cancel_rate,
    hourly_rate: p.hourly_rate,
    visit_fee: p.visit_fee,
    daily_capacity: p.daily_capacity,
    jobs_today: 0,
    blacklisted: false,
    risk_score: 0.05,
    gender: p.gender ?? null,
    languages: p.languages,
    bio: p.bio,
  }));
}

const exampleIntent: Intent = {
  service_type: "ac_repair",
  service_label: "AC repair",
  issue_severity: "high",
  location: { raw: "G-13 Islamabad", city: "Islamabad", area: "G-13" },
  time: { kind: "tomorrow_morning", raw: "kal subah" },
  urgency: "high",
  price_sensitivity: "high",
  constraints: [],
  complexity_hint: "complex",
  detected_languages: ["ur-Latn", "en"],
  confidence: 0.92,
  clarifying_questions: [],
  rationale: "Test intent: AC repair, G-13, urgent, budget-sensitive.",
};

const customerLocation = { lat: 33.6480, lng: 72.9728 }; // G-13 center

(async () => {
  const trace = new TraceCollector("smoke");
  const candidates = asProviderRows().filter((p) => p.primary_service === exampleIntent.service_type);
  console.log(`Pool size: ${candidates.length} AC providers seeded.`);

  // --- Match ---
  const { ranking, considered, rejected } = await matchProviders({
    intent: exampleIntent,
    candidates,
    customerLocation,
    trace,
  });
  console.log(`\n— Match (${considered} considered, ${rejected.length} rejected) —`);
  for (const r of ranking) {
    console.log(`  ${r.score.toFixed(1).padStart(5)}  ${r.name.padEnd(34)}  ${r.distance_km}km  flags=${r.flags.join("|") || "—"}`);
  }

  if (!ranking.length) { console.error("FAIL: empty ranking"); process.exit(1); }

  // Assert: the highest specialization+reliability provider wins, NOT necessarily the nearest.
  const top = ranking[0];
  console.log(`  ✓ top: ${top.name}  rationale: ${top.why}`);

  // --- Price ---
  const demand = estimateDemandIndex(exampleIntent);
  const quote = quotePrice({
    intent: exampleIntent,
    provider: top.provider,
    travel_km: top.distance_km,
    demand_index: demand,
    loyalty_tier: "new",
    trace,
  });
  console.log(`\n— Price quote (demand=${demand.toFixed(2)}) — total: PKR ${quote.total.toLocaleString()}`);
  for (const li of quote.line_items) {
    console.log(`    ${li.label.padEnd(28)}  ${li.amount >= 0 ? "+" : ""}${li.amount.toLocaleString()} PKR  ${li.note ?? ""}`);
  }
  if (quote.budget_friendly_alternative) {
    console.log(`  💡 budget option: PKR ${quote.budget_friendly_alternative.total.toLocaleString()} — ${quote.budget_friendly_alternative.swap}`);
  }

  // --- Dispute ---
  console.log(`\n— Dispute: quality complaint with photo evidence —`);
  const decision = resolveDispute({
    case_type: "quality",
    booking: {
      id: "demo",
      total_price: quote.total,
      on_time_delta_min: 5,
      proof_photo_urls: ["https://example/proof.jpg"],
      cancelled_by: null,
      actual_start: null,
      actual_end: null,
      scheduled_start: null,
    },
    customer_rating: 2,
    customer_comment: "AC still not cooling, left mess.",
    provider_prior_disputes_30d: 0,
    customer_prior_disputes_30d: 0,
    safety_flag: false,
  }, trace);
  console.log(`  decision: ${decision.decision}, refund: PKR ${decision.refund_amount.toLocaleString()}, prov rep delta: ${decision.reputation_delta.provider}`);
  console.log(`  rationale: ${decision.rationale}`);

  console.log(`\n— Trace summary —  ${trace.list().length} events`);
  for (const t of trace.list()) {
    console.log(`  [${t.agent}] ${t.step}  ${t.latency_ms ?? ""}ms`);
  }
  console.log("\n✅ smoke test passed");
})().catch((e) => {
  console.error("smoke test failed:", e);
  process.exit(1);
});
