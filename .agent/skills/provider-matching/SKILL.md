---
name: provider-matching
description: Use after intent extraction to rank candidate service providers using a multi-factor weighted score, not distance alone. Returns top-K with per-factor rationale.
---

# Skill: Multi-factor Provider Matching

## Goal
Given an extracted intent and a candidate pool (from Supabase mock providers + Google Places), produce a ranked list of 3–5 providers with a transparent per-factor breakdown.

## Factors (11)
| # | Factor | Weight | Source | Notes |
|---|---|---|---|---|
| 1 | Travel time (live) | 0.18 | Places + Haversine fallback | Penalize >45 min sharply |
| 2 | Availability fit | 0.16 | `provider_availability` table | Hard filter then soft score for slot proximity |
| 3 | Rating (Bayesian) | 0.12 | reviews | Use Bayesian average against global mean to debias new providers |
| 4 | Review recency | 0.06 | reviews | Decay older reviews; surface recent negative reviews |
| 5 | On-time reliability | 0.10 | bookings.actual_arrival_delta | Z-score against pool |
| 6 | Skill specialization match | 0.12 | providers.skills[] vs intent.service_type + complexity_hint | Exact-skill + complexity tier match |
| 7 | Price fit | 0.08 | providers.hourly_rate + intent.price_sensitivity | Inverse if `price_sensitivity=high` |
| 8 | Capacity headroom | 0.05 | open slots today | 0 if at capacity |
| 9 | Cancellation rate | 0.06 | bookings | Penalize >10% |
| 10 | User preference | 0.04 | user_prefs (history, language, gender constraints) | Hard filter when `female_only`, etc. |
| 11 | Risk score | 0.03 | composite: recent disputes, blacklist proximity | Hard exclude if blacklisted |

Weights sum to 1.00. Re-normalize on missing data.

## Procedure
1. Hard filters: blacklist, capacity=0, hard preferences (`female_only`, `english_speaking`, certifications), service type mismatch.
2. Score each provider 0–100 per factor; multiply by weight; sum.
3. **Tie-break / boost**: if a provider has `specialization_level === intent.complexity_hint` and on-time ≥ 0.9 and rating ≥ 4.4, apply +5 to final score (this is the example-scenario "Provider A over closer Provider B" behavior).
4. Sort desc; return top 5 with per-factor `score` map and a one-line `why`.
5. Emit a `TraceEvent` with `output.candidates`, `output.weights`, and per-provider rationale.

## Output schema
```ts
{
  ranking: Array<{
    provider_id: string,
    name: string,
    score: number,                      // 0..100
    breakdown: Record<FactorName, { raw: number, weighted: number }>,
    why: string,                         // 1-sentence rationale, e.g. "Higher reliability and specialized AC reviews outweigh +2km extra travel."
    flags: string[]                      // e.g. "recent_negative_review", "high_demand"
  }>,
  considered: number,
  rejected_reasons: Record<string, string>,
  rationale: string                     // overall summary of why ranking turned out this way
}
```

## Example
For "AC, G-13, tomorrow morning, budget low":
- Provider A (1.8km, rating 4.6, on-time 0.94, AC-specialist, intermediate-certified, rate 1400 PKR/visit) → 87
- Provider B (1.1km, rating 4.7, on-time 0.81, generalist, rate 1800) → 79
- The skill emits `why: "Specialization + reliability beat marginally shorter distance."`
