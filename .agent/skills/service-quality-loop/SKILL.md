---
name: service-quality-loop
description: Use during and after a service to track en-route updates, completion checklist, photo evidence, customer feedback, and reputation updates that feed future matching.
---

# Skill: Service Quality Loop

## Stages
1. **Pre-service reminder** (T-2h, T-30m): notification to user + provider.
2. **En-route**: provider opens app → status `en_route` with ETA. Trace: "ETA 12 min, traffic factor 1.2".
3. **Arrival**: status `in_progress`. Start service timer.
4. **Completion checklist**:
   - service-type-specific items (e.g. AC service: filter cleaned, gas pressure, drain test).
   - photo/video evidence placeholders uploaded to Supabase storage `proofs` bucket.
   - customer signs off.
5. **Feedback**:
   - star rating 1–5
   - sentiment-scored comment (Gemini `gemini-2.5-flash` sentiment call, output { score:-1..1, themes:[] }).
   - photo of finished work.
6. **Reputation update**: weighted EWMA on provider score; recent reviews count 2× more than 90-day-old; sentiment themes feed into specialization tagging.
7. **Future matching impact**: positive themes (e.g. "punctual", "explained well") boost `specialization_level` and `on_time_score`. Negative themes (e.g. "left mess", "overcharged") add temporary penalty + visible flag on next match.

## Output (per stage)
Each stage emits a `TraceEvent`; the final review emits:
```ts
{
  rating: number,
  sentiment: { score: number, themes: string[] },
  reputation_delta: { rating_ewma: number, on_time_delta: number, specialization_boost: number },
  flags: string[]
}
```
