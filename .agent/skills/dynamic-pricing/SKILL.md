---
name: dynamic-pricing
description: Use after a provider is selected to produce a transparent dynamic price quote with line items. Considers demand, urgency, distance, complexity, provider rate, loyalty discount, and surge.
---

# Skill: Dynamic Pricing with Transparent Breakdown

## Goal
Generate a fair quote both user and provider can defend, with every adjustment shown.

## Inputs
- `provider.base_rate` (PKR), `provider.visit_fee`
- `intent.complexity_hint`, `intent.urgency`, `intent.price_sensitivity`
- `travel_km`
- `time_slot` (peak/off-peak)
- `demand_index` for area+service (0..2)
- `user.loyalty_tier` ("new" | "regular" | "loyal")
- `surge_threshold = 1.3`

## Line items (always shown)
1. **Visit fee** — flat per-provider value.
2. **Service fee** — `base_rate * complexity_multiplier` where `{basic:1.0, intermediate:1.4, complex:1.9}`.
3. **Distance** — `travel_km * 35 PKR` capped at 600 PKR.
4. **Urgency adjustment** — `{low:0, medium:+5%, high:+12%, emergency:+25%}` applied to service fee.
5. **Demand surge** — only if `demand_index ≥ surge_threshold`; surge = `(demand_index - 1) * service_fee * 0.4`, capped at +20%. Show explicitly.
6. **Loyalty discount** — `{new:0, regular:-3%, loyal:-7%}` on subtotal.
7. **Platform fee** — flat 50 PKR (transparent).
8. **Tax** — none for now.

## Output schema
```ts
{
  currency: "PKR",
  line_items: Array<{ label: string, amount: number, kind: "fee" | "adjustment" | "discount" | "surge", note?: string }>,
  subtotal: number,
  total: number,
  budget_friendly_alternative?: {
    total: number,
    swap: string,                 // e.g. "Move to off-peak 2pm slot, drop urgency to medium"
  },
  fairness: {
    user_view: string,            // why this is fair to user
    provider_view: string         // why this is fair to provider
  },
  rationale: string
}
```

## Procedure
1. Build line items in the order above.
2. If `intent.price_sensitivity = high` AND `total > provider.base_rate * 2.2`, compute a `budget_friendly_alternative` by dropping urgency one tier and shifting to off-peak.
3. Round line items to whole PKR.
4. Emit trace with full breakdown and `rationale` like "Surge applied because area `G-13` AC demand index is 1.45 (above 1.30 threshold)."
