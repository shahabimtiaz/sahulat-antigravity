import type { Intent, ProviderRow, PriceQuote } from "./types";
import type { TraceCollector } from "./trace";
import { getCachedProvenance, getSkillProvenance } from "./skill-loader";

// Warm the cache so the synchronous trace push can attach provenance.
getSkillProvenance("dynamic-pricing").catch(() => undefined);

const COMPLEXITY_MULT: Record<Intent["complexity_hint"], number> = {
  basic: 1.0, intermediate: 1.4, complex: 1.9,
};

const URGENCY_PCT: Record<Intent["urgency"], number> = {
  low: 0, medium: 0.05, high: 0.12, emergency: 0.25,
};

type PriceInput = {
  intent: Intent;
  provider: ProviderRow;
  travel_km: number;
  /** 1.0 = normal demand; >1.3 triggers surge. */
  demand_index: number;
  loyalty_tier: "new" | "regular" | "loyal";
  trace: TraceCollector;
};

export function quotePrice(input: PriceInput): PriceQuote {
  const t0 = Date.now();
  const { intent, provider, travel_km, demand_index, loyalty_tier, trace } = input;

  const lineItems: PriceQuote["line_items"] = [];

  const visit_fee = provider.visit_fee;
  if (visit_fee > 0) {
    lineItems.push({ label: "Visit fee", amount: visit_fee, kind: "fee" });
  }

  const service_fee = Math.round(provider.hourly_rate * COMPLEXITY_MULT[intent.complexity_hint]);
  lineItems.push({
    label: `Service fee (${intent.complexity_hint})`,
    amount: service_fee,
    kind: "fee",
    note: `Hourly ${provider.hourly_rate} × ${COMPLEXITY_MULT[intent.complexity_hint]} complexity`,
  });

  const distance_fee = Math.min(600, Math.round(travel_km * 35));
  if (distance_fee > 0) {
    lineItems.push({
      label: "Distance",
      amount: distance_fee,
      kind: "fee",
      note: `${travel_km.toFixed(1)}km × 35 PKR (capped at 600)`,
    });
  }

  const urgencyPct = URGENCY_PCT[intent.urgency];
  const urgency_amount = Math.round(service_fee * urgencyPct);
  if (urgency_amount > 0) {
    lineItems.push({
      label: `Urgency (${intent.urgency})`,
      amount: urgency_amount,
      kind: "adjustment",
      note: `+${(urgencyPct * 100).toFixed(0)}% on service fee`,
    });
  }

  let surge_amount = 0;
  if (demand_index >= 1.3) {
    surge_amount = Math.min(Math.round(service_fee * 0.2), Math.round((demand_index - 1) * service_fee * 0.4));
    lineItems.push({
      label: "Demand surge",
      amount: surge_amount,
      kind: "surge",
      note: `Area demand index ${demand_index.toFixed(2)} (>1.30 threshold)`,
    });
  }

  const preDiscountSubtotal = visit_fee + service_fee + distance_fee + urgency_amount + surge_amount;

  const loyaltyPct = loyalty_tier === "loyal" ? -0.07 : loyalty_tier === "regular" ? -0.03 : 0;
  const loyalty_amount = Math.round(preDiscountSubtotal * loyaltyPct);
  if (loyalty_amount !== 0) {
    lineItems.push({
      label: `Loyalty (${loyalty_tier})`,
      amount: loyalty_amount,
      kind: "discount",
      note: `${(loyaltyPct * 100).toFixed(0)}% on subtotal`,
    });
  }

  const platform_fee = 50;
  lineItems.push({ label: "Platform fee", amount: platform_fee, kind: "fee" });

  const subtotal = preDiscountSubtotal + loyalty_amount;
  const total = subtotal + platform_fee;

  let budget_friendly_alternative: PriceQuote["budget_friendly_alternative"];
  if (intent.price_sensitivity === "high" && total > provider.hourly_rate * 2.2) {
    const downgradedUrgency = intent.urgency === "emergency" ? "high"
      : intent.urgency === "high" ? "medium" : intent.urgency === "medium" ? "low" : "low";
    const altUrgencyAmount = Math.round(service_fee * URGENCY_PCT[downgradedUrgency]);
    const altPreDiscount = visit_fee + service_fee + distance_fee + altUrgencyAmount;   // drop surge & current urgency
    const altSubtotal = altPreDiscount + Math.round(altPreDiscount * loyaltyPct);
    const altTotal = altSubtotal + platform_fee;
    budget_friendly_alternative = {
      total: altTotal,
      swap: `Move to an off-peak slot and drop urgency to ${downgradedUrgency}.`,
    };
  }

  const quote: PriceQuote = {
    currency: "PKR",
    line_items: lineItems,
    subtotal,
    total,
    budget_friendly_alternative,
    fairness: {
      user_view: intent.price_sensitivity === "high"
        ? `Visit and distance are exact costs. Service fee scales with ${intent.complexity_hint} complexity${urgencyPct > 0 ? `; urgency adjustment shown explicitly` : ""}.${budget_friendly_alternative ? " A cheaper alternative is suggested below." : ""}`
        : `All charges are shown line by line, no hidden fees.`,
      provider_view: `Earnings include base service fee (${COMPLEXITY_MULT[intent.complexity_hint]}× of hourly), distance reimbursement, ${surge_amount ? "demand surge share" : "no surge"}, minus platform fee.`,
    },
    rationale: `Service ${service_fee} + distance ${distance_fee} + urgency ${urgency_amount}${surge_amount ? ` + surge ${surge_amount}` : ""}${loyalty_amount ? ` + loyalty ${loyalty_amount}` : ""} + platform ${platform_fee}. ${surge_amount ? `Surge active (demand ${demand_index.toFixed(2)}).` : ""}`,
  };

  trace.push({
    agent: "pricer",
    step: "quote",
    input_summary: `${provider.name} | complexity=${intent.complexity_hint} urgency=${intent.urgency} sensitivity=${intent.price_sensitivity} demand=${demand_index.toFixed(2)}`,
    output: quote,
    rationale: quote.rationale,
    latency_ms: Date.now() - t0,
    skill: getCachedProvenance("dynamic-pricing"),
  });

  return quote;
}

/** Heuristic demand index. Replace with real signal later. */
export function estimateDemandIndex(intent: Intent): number {
  // emergency or peak time = higher demand. Tomorrow morning peak for AC in summer.
  const base = 1.0;
  const urgencyBoost = intent.urgency === "emergency" ? 0.45 : intent.urgency === "high" ? 0.25 : 0.05;
  const slotBoost = intent.time.kind === "tomorrow_morning" || intent.time.kind === "asap" ? 0.15 : 0;
  const seasonBoost = intent.service_type === "ac_repair" ? 0.15 : 0; // summer-ish bias
  return Math.min(2.0, base + urgencyBoost + slotBoost + seasonBoost);
}
