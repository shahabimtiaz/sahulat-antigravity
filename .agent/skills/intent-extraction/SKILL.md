---
name: intent-extraction
description: Use when a user submits a free-text service request in Urdu, Roman Urdu, English, or any code-switched mix. Extracts service type, location, urgency, preferred time, budget sensitivity, constraints, and emits a confidence score with clarifying questions when confidence is low.
---

# Skill: Multilingual Intent Extraction

## Goal
Convert a noisy, possibly code-switched message such as "AC bilkul kaam nahi kar raha, kal subah G-13 mein technician chahiye, budget zyada nahi hai" into a strict structured intent object.

## Output schema (zod-enforced)
```ts
{
  service_type: "ac_repair" | "plumbing" | "electrical" | "appliance_repair" | "cleaning" | "tutoring" | "beauty" | "driver" | "mechanic" | "carpentry" | "other",
  service_label: string,                 // human label in the user's dominant language
  issue_severity: "low" | "medium" | "high",
  location: { raw: string, city?: string, area?: string, lat?: number, lng?: number },
  time: { kind: "asap" | "today" | "tomorrow_morning" | "tomorrow_afternoon" | "tomorrow_evening" | "specific", iso?: string, raw: string },
  urgency: "low" | "medium" | "high" | "emergency",
  price_sensitivity: "low" | "medium" | "high",
  constraints: string[],                  // e.g. "female_only", "english_speaking", "with_tools"
  complexity_hint: "basic" | "intermediate" | "complex",
  detected_languages: ("ur" | "ur-Latn" | "en")[],
  confidence: number,                     // 0..1
  clarifying_questions: string[],         // empty when confidence ≥ 0.75
  rationale: string                       // 1-2 sentence reasoning
}
```

## Procedure
1. Detect script: if the message contains Arabic-script tokens treat them as `ur`; Latin-script Urdu words ("kal", "subah", "chahiye", "ghar", "wala") count as `ur-Latn`; otherwise `en`.
2. Map common Roman-Urdu service phrases:
   - "AC", "AC service", "thanda" → `ac_repair`
   - "plumber", "paani", "leak", "nalka" → `plumbing`
   - "electrician", "bijli", "switch", "wiring" → `electrical`
   - "safai", "cleaning", "maid" → `cleaning`
   - "tutor", "padhana", "teacher" → `tutoring`
   - "beautician", "facial", "haircut", "salon at home" → `beauty`
   - "driver", "car chalana" → `driver`
   - "mechanic", "gaari", "car kharab" → `mechanic`
   - "carpenter", "lakri", "almari" → `carpentry`
3. Time parsing — relative to current ISO timestamp injected as `{{now}}` in the system prompt:
   - "abhi" / "right now" / "urgent" → `urgency=emergency`, `time.kind=asap`.
   - "kal subah" / "tomorrow morning" → `tomorrow_morning` and ISO 09:00 local.
   - "shaam" → afternoon/evening.
4. Severity heuristics: "bilkul kaam nahi", "leak", "spark", "no power" → `high`. "thoda problem", "kabhi kabhi" → `low`.
5. Price sensitivity: "budget zyada nahi", "sasta", "cheap", "affordable" → `high`.
6. Complexity classification (used downstream by matcher):
   - basic: routine service (cleaning, basic AC service)
   - intermediate: minor repair (leak fix, switch replacement)
   - complex: full unit failure, rewiring, multi-issue diagnosis
7. Confidence ≥ 0.75 → no clarifying questions. Otherwise ask the smallest set (max 2) that closes the gap — in the user's dominant language. Examples:
   - low location confidence → "Kis area mein? (Which area in city?)"
   - ambiguous service → "Kya AC service chahiye ya repair?"
8. Always populate `rationale` with 1–2 sentences explaining the key inferences.

## Constraints
- Never invent a location not in the input. If only a city is mentioned, leave `area` undefined and ask.
- Do NOT translate user-facing clarifying questions into a different language than the user's dominant language.
- If the message contains profanity directed at a provider/user → set `constraints` to include `"requires_human_review"` and confidence ≤ 0.4.
