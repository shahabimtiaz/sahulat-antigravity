---
name: provider-optimization
description: Use on the provider side to balance workload, surface fair earning opportunities, forecast demand, and recommend time slots that maximize utilization without burnout.
---

# Skill: Provider-side Optimization

## Goals
- Distribute jobs so no provider in a service+area is starved while others are saturated.
- Maximize provider earnings without scheduling beyond their daily cap (default 6 jobs).
- Forecast next-24h demand by service+area using rolling 7-day baseline + day-of-week factor.

## Procedure
1. Compute per-provider `utilization = jobs_today / daily_cap`.
2. When matcher ranks providers and two are within 3 score-points, prefer the one with lower utilization (fairness boost).
3. For each provider, every morning, recommend:
   - top 3 slots most likely to receive demand (based on forecast).
   - any "earning gap" days where their utilization < 0.3.
4. Demand forecast formula: `forecast(h) = baseline_avg(service, area, h) * dow_factor * trend_factor`.

## Output
```ts
{
  recommendations: Array<{ provider_id: string, suggested_slots: string[], reason: string }>,
  demand_forecast: Array<{ service: string, area: string, hour: number, expected_jobs: number }>
}
```
