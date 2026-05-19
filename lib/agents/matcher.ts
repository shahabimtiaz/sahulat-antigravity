import type { Intent, ProviderRow, RankedProvider, FactorName } from "./types";
import { FACTOR_WEIGHTS, FactorNames } from "./types";
import type { TraceCollector } from "./trace";
import { getSkillProvenance } from "./skill-loader";

// Haversine distance (km).
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Bayesian rating correction: pulls low-count averages toward the global mean.
function bayesianRating(p: ProviderRow, globalMean = 4.4, m = 15): number {
  return (p.rating_count * p.rating_avg + m * globalMean) / (p.rating_count + m);
}

type Scoreable = {
  row: ProviderRow;
  distance_km: number;
  factor: Record<FactorName, number>;   // 0..100
};

function clamp(v: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, v)); }

function scoreProvider(p: ProviderRow, intent: Intent, customerLocation: { lat: number; lng: number }, poolStats: { onTimeMean: number; cancelMean: number; rateMean: number }): Scoreable {
  const distance_km = haversineKm(customerLocation, { lat: p.lat, lng: p.lng });

  // 1. travel_time — 0km → 100; 45km → 0 (linear w/ knee at 10km).
  const travel = distance_km <= 10
    ? 100 - distance_km * 4               // 10km → 60
    : Math.max(0, 60 - (distance_km - 10) * (60 / 35)); // 45km → 0

  // 2. availability — capacity headroom is hard requirement upstream; here, slot proximity.
  const headroom = (p.daily_capacity - p.jobs_today) / Math.max(1, p.daily_capacity);
  const availability = clamp(headroom * 100);

  // 3. rating — Bayesian-corrected against global mean.
  const bayes = bayesianRating(p);
  const rating = clamp(((bayes - 3.0) / 2.0) * 100); // 3.0 → 0, 5.0 → 100

  // 4. review_recency — penalize recent negative reviews.
  const review_recency = clamp(100 - p.recent_negative_review_count * 18);

  // 5. on_time_reliability — relative to pool mean (z-ish, soft).
  const onTimeDelta = p.on_time_score - poolStats.onTimeMean;
  const on_time_reliability = clamp(70 + onTimeDelta * 200); // -0.15 → 40; +0.10 → 90

  // 6. skill_specialization — exact-skill + complexity tier + sentiment-grown tags.
  const wantedSkillHits = (() => {
    const intentSkillCues = serviceSkillCues(intent);
    return intentSkillCues.filter((s) => p.skills.includes(s)).length;
  })();
  const complexityFit = p.specialization_level === intent.complexity_hint ? 1
    : (p.specialization_level === "complex" && intent.complexity_hint === "intermediate") ? 0.85
    : (p.specialization_level === "intermediate" && intent.complexity_hint === "basic") ? 0.9
    : 0.5;
  // Tags grown from positive review sentiment ("punctual", "clear_explanation"...)
  // each contribute a small boost capped at +12.
  const tagBoost = Math.min(12, (p.specialization_tags?.length ?? 0) * 2);
  const skill_specialization = clamp(40 + wantedSkillHits * 12 + complexityFit * 30 + tagBoost);

  // 7. price_fit — inverse if user is price-sensitive.
  const meanRate = poolStats.rateMean || 1000;
  const ratio = p.hourly_rate / meanRate; // 1.0 = at mean
  const price_fit = intent.price_sensitivity === "high"
    ? clamp(120 - ratio * 80)           // cheap is better
    : intent.price_sensitivity === "low"
      ? clamp(40 + ratio * 40)          // premium acceptable
      : clamp(100 - Math.abs(1 - ratio) * 60); // near mean is best

  // 8. capacity — headroom hard score.
  const capacity = clamp(headroom * 100);

  // 9. cancellation — penalize >10%.
  const cancellation = clamp(100 - Math.max(0, p.cancel_rate - 0.04) * 600);

  // 10. user_preference — placeholder. Hard filters happen upstream; here a soft language match boost.
  const userLangMatch = p.languages.some((l) => intent.detected_languages.includes(l as never)) ? 100 : 60;
  const user_preference = userLangMatch;

  // 11. risk — invert risk_score (0..1).
  const risk = clamp(100 - p.risk_score * 200);

  return {
    row: p,
    distance_km,
    factor: {
      travel_time: travel,
      availability,
      rating,
      review_recency,
      on_time_reliability,
      skill_specialization,
      price_fit,
      capacity,
      cancellation,
      user_preference,
      risk,
    },
  };
}

function serviceSkillCues(intent: Intent): string[] {
  const map: Record<string, string[]> = {
    ac_repair: intent.complexity_hint === "complex"
      ? ["inverter_diagnosis", "compressor_replace", "pcb_repair", "split_ac_install"]
      : intent.complexity_hint === "intermediate"
        ? ["split_ac_service", "split_ac_install", "gas_refill"]
        : ["window_ac_service", "general_diagnosis"],
    plumbing: intent.complexity_hint === "complex"
      ? ["sewer_jetting", "pipe_replace"]
      : ["leak_repair", "tap_install", "drain_clearance", "geyser_install"],
    electrical: intent.complexity_hint === "complex"
      ? ["wiring", "breaker_install", "solar_inverter"]
      : ["switch_replace", "fan_install", "ups_setup"],
    cleaning: ["deep_clean", "kitchen_clean", "bathroom_clean", "general_clean"],
    beauty: ["facial", "haircut", "manicure_pedicure", "bridal"],
    tutoring: ["math_olevel", "math_alevel", "physics_olevel", "english_olevel"],
    appliance_repair: ["fridge_repair", "washing_machine", "microwave"],
    mechanic: ["battery_jumpstart", "tyre_change", "minor_engine", "oil_change"],
    carpentry: ["furniture_repair", "door_install", "custom_shelf"],
    driver: ["intercity", "airport_pickup", "manual_transmission"],
    other: [],
  };
  return map[intent.service_type] ?? [];
}

function applyWeights(s: Scoreable): RankedProvider {
  const breakdown = {} as Record<FactorName, { raw: number; weighted: number }>;
  let score = 0;
  for (const f of FactorNames) {
    const raw = s.factor[f];
    const weighted = raw * FACTOR_WEIGHTS[f];
    breakdown[f] = { raw: Math.round(raw), weighted: Math.round(weighted * 10) / 10 };
    score += weighted;
  }
  return {
    provider_id: s.row.id,
    name: s.row.name,
    city: s.row.city,
    area: s.row.area,
    lat: s.row.lat,
    lng: s.row.lng,
    distance_km: Math.round(s.distance_km * 10) / 10,
    score: Math.round(score * 10) / 10,
    breakdown,
    why: "",
    flags: [],
    provider: s.row,
  };
}

export type MatchOpts = {
  intent: Intent;
  candidates: ProviderRow[];
  customerLocation: { lat: number; lng: number };
  trace: TraceCollector;
};

export async function matchProviders({ intent, candidates, customerLocation, trace }: MatchOpts): Promise<{
  ranking: RankedProvider[];
  considered: number;
  rejected: Array<{ provider_id: string; reason: string }>;
}> {
  const t0 = Date.now();
  const skill = await getSkillProvenance("provider-matching").catch(() => undefined);

  // ---- Hard filters ----
  const rejected: Array<{ provider_id: string; reason: string }> = [];
  const eligible = candidates.filter((p) => {
    if (p.blacklisted) { rejected.push({ provider_id: p.id, reason: "blacklisted" }); return false; }
    if (p.primary_service !== intent.service_type) { rejected.push({ provider_id: p.id, reason: "service mismatch" }); return false; }
    if (p.daily_capacity - p.jobs_today <= 0) { rejected.push({ provider_id: p.id, reason: "no capacity today" }); return false; }
    if (intent.constraints.includes("female_only") && p.gender && p.gender !== "female") {
      rejected.push({ provider_id: p.id, reason: "gender pref" }); return false;
    }
    if (intent.constraints.includes("english_speaking") && !p.languages.includes("en")) {
      rejected.push({ provider_id: p.id, reason: "language pref" }); return false;
    }
    return true;
  });

  if (!eligible.length) {
    trace.push({
      agent: "matcher",
      step: "rank",
      input_summary: `${candidates.length} candidates, ${rejected.length} rejected`,
      output: { ranking: [], considered: 0, rejected },
      rationale: "All candidates rejected by hard filters.",
      latency_ms: Date.now() - t0,
      skill,
    });
    return { ranking: [], considered: 0, rejected };
  }

  // ---- Pool stats ----
  const poolStats = {
    onTimeMean: avg(eligible.map((p) => p.on_time_score)),
    cancelMean: avg(eligible.map((p) => p.cancel_rate)),
    rateMean: avg(eligible.map((p) => p.hourly_rate)),
  };

  // ---- Score ----
  let ranked = eligible
    .map((p) => scoreProvider(p, intent, customerLocation, poolStats))
    .map(applyWeights);

  // ---- Boosts & flags ----
  for (const r of ranked) {
    const p = r.provider;
    if (p.specialization_level === intent.complexity_hint && p.on_time_score >= 0.9 && p.rating_avg >= 4.4) {
      r.score = Math.round((r.score + 5) * 10) / 10;
      r.flags.push("specialization_match_boost");
    }
    if (p.recent_negative_review_count >= 2) r.flags.push("recent_negative_review");
    if (p.cancel_rate >= 0.12) r.flags.push("high_cancel_rate");
    if (p.jobs_today / p.daily_capacity >= 0.8) r.flags.push("high_demand");
  }

  ranked.sort((a, b) => b.score - a.score);
  ranked = ranked.slice(0, 5);

  // ---- Rationales ----
  for (const r of ranked) {
    const winningFactors = (Object.entries(r.breakdown) as Array<[FactorName, { raw: number; weighted: number }]>)
      .sort((a, b) => b[1].weighted - a[1].weighted)
      .slice(0, 2)
      .map(([f]) => prettyFactor(f));
    r.why = `Top factors: ${winningFactors.join(" + ")}. ${r.distance_km}km away, rating ${r.provider.rating_avg.toFixed(1)} (${r.provider.rating_count}), on-time ${(r.provider.on_time_score * 100).toFixed(0)}%.`;
  }

  const summary = ranked.map((r) => ({ name: r.name, score: r.score, distance_km: r.distance_km, flags: r.flags }));
  trace.push({
    agent: "matcher",
    step: "rank",
    input_summary: `intent.service=${intent.service_type} complexity=${intent.complexity_hint} candidates=${candidates.length}`,
    output: { ranking_summary: summary, weights: FACTOR_WEIGHTS, rejected_count: rejected.length },
    rationale: ranked.length
      ? `Ranked ${ranked.length} providers. Top pick: ${ranked[0].name} (score ${ranked[0].score}). ${ranked.length > 1 && ranked[1].distance_km < ranked[0].distance_km ? `Closer provider ${ranked[1].name} ranked #2 because of lower specialization fit.` : ""}`
      : "No eligible providers.",
    latency_ms: Date.now() - t0,
    skill,
  });

  return { ranking: ranked, considered: eligible.length, rejected };
}

function avg(xs: number[]): number { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }

function prettyFactor(f: FactorName): string {
  return ({
    travel_time: "travel time",
    availability: "availability",
    rating: "rating",
    review_recency: "recent reviews",
    on_time_reliability: "on-time reliability",
    skill_specialization: "skill specialization",
    price_fit: "price fit",
    capacity: "capacity",
    cancellation: "low cancellation",
    user_preference: "preference match",
    risk: "low risk",
  })[f];
}
