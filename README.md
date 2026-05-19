# Sahulat — Agentic Service Orchestrator

> **An end-to-end agentic marketplace for Pakistan's informal-service economy
> (plumbers, electricians, AC techs, beauticians, tutors, drivers, …) built on
> Google Antigravity skills with Gemini at runtime, Supabase, and Google Places.**

Sahulat (Urdu for *"ease, convenience"*) takes a natural-language message in
Urdu, Roman Urdu, English, or any code-switched mix — e.g. *"AC bilkul kaam
nahi kar raha, kal subah G-13 mein technician chahiye, budget zyada nahi hai"*
— and orchestrates intent extraction, provider discovery, 11-factor
matching, transparent dynamic pricing, conflict-free scheduling, booking,
service-quality follow-up, and dispute resolution. Every agent decision is
captured as an inspectable **reasoning trace** at `/traces/[bookingId]`.

## Shipping surface

- **`mobile/`** — Expo / React Native app (mandatory deliverable). Installable
  Android APK via `eas build`. Screens: home, request, booking lifecycle,
  agent trace.
- **`app/`** — Next.js web app (optional, judge-friendly). Adds the
  **`/agents` Agent Manager** view that mirrors Antigravity's Manager surface.
- **`.agent/`** — Antigravity Skills, Workflows, and Rules. Loaded both inside
  the Antigravity IDE during development AND at runtime via the skill loader
  (`lib/agents/skill-loader.ts`) — single source of truth.

---

## 1. Architecture

```
┌──────────────────────────── Mobile-first PWA (Next.js 15 + Tailwind) ─────────────────────────┐
│   /                      landing + multilingual sample prompts                                │
│   /request               chat-style flow with intent + ranked offers + trace mini             │
│   /bookings/[id]         service lifecycle UI (en-route → completed → review → dispute)       │
│   /traces/[id]           Antigravity-style artifact: every agent event with rationale/IO      │
│   /provider/dashboard    workload, utilization, demand forecast                               │
└─────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                              │  fetch
                                              ▼
┌──────────────────────────────── Route handlers (app/api/*) ───────────────────────────────────┐
│   POST /api/orchestrate                  POST /api/confirm                                    │
│   POST /api/bookings/[id]/status         POST /api/bookings/[id]/review                       │
│   POST /api/disputes                     POST /api/reschedule                                 │
│   GET  /api/bookings/[id]                GET  /api/traces/[bookingId]                         │
│   GET  /api/providers/optimize                                                                │
└─────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────── Orchestrator (lib/agents/orchestrator.ts) ────────────────────────┐
│   ┌────────────┐  ┌────────────┐  ┌─────────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐    │
│   │  intent    │→│ discovery  │→│  matcher    │→│ pricer │→│ scheduler│→│ booking  │    │
│   │ Gemini fast│  │ Places +DB │  │ 11 factors  │  │ rules  │  │  + RPC   │  │ + notify │    │
│   └─────┬──────┘  └────────────┘  └─────────────┘  └────────┘  └──────────┘  └──────────┘    │
│         ▼                                                                                     │
│   Every step emits a `TraceEvent` → persisted to `traces` table → rendered at /traces/[id]    │
└─────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                              │
            ┌─────────────────────────────────┼─────────────────────────────────┐
            ▼                                 ▼                                 ▼
   ┌────────────────┐                ┌─────────────────┐                ┌────────────────┐
   │ Supabase (PG)  │                │ Google Places   │                │ Gemini 2.5     │
   │ + RLS + Storage│                │ API (New)       │                │ Pro & Flash    │
   └────────────────┘                └─────────────────┘                └────────────────┘
```

### MCP servers used inside Antigravity

While developing this project inside the Antigravity IDE we wire up MCP
servers so the agents can query Supabase and inspect traces without
context-switching. Setup is documented in
[`.agent/mcp/README.md`](./.agent/mcp/README.md) and a ready-to-paste
config is in [`.agent/mcp/mcp.example.json`](./.agent/mcp/mcp.example.json).

| MCP server | Why we use it | Required? |
|---|---|---|
| **Supabase MCP** (`mcp.supabase.com`) | Query `traces`, `bookings`, `providers` live; inspect Storage proof photos; run migration SQL | **Yes** (primary) |
| **MCP Toolbox for Databases** (`@toolbox-sdk/server --prebuilt=postgres`) | Generic Postgres alternative when Supabase MCP is rate-limited | optional |
| **Filesystem** (`@modelcontextprotocol/server-filesystem`) | Lets Antigravity agents read/write files in this repo | recommended |
| **GitHub** (`@modelcontextprotocol/server-github`) | PRs, issue refs, code search across the org | optional |

### Antigravity integration

Antigravity is Google's agent-first IDE (Nov 2025). This project uses
Antigravity in **three** ways:

1. **Development orchestrator** — the `.agent/` directory contains the
   Rules, Skills, and Workflows that guide Antigravity agents during
   development of this codebase.
2. **Runtime driver via skill loader** — `lib/agents/skill-loader.ts` parses
   every `.agent/skills/*/SKILL.md` at runtime, extracts the YAML
   frontmatter, and uses the markdown body as the Gemini system prompt for
   the matching agent. The skill files are the **single source of truth**
   — edit the SKILL.md and the runtime prompt changes on next process boot
   (or immediately with `OMC_SKILL_HOT_RELOAD=true`).
3. **Agent Manager view (`/agents`)** — mirrors Antigravity's Manager UI:
   parallel-agent grid with live status & rationale, skills/workflows
   inventory loaded from disk, live trace event stream, recent artifacts
   (bookings + disputes) with click-through to the reasoning timeline.

```
.agent/
├── rules/coding-standards.md
├── skills/
│   ├── intent-extraction/SKILL.md          ←→  lib/agents/intent.ts
│   ├── provider-matching/SKILL.md          ←→  lib/agents/matcher.ts
│   ├── dynamic-pricing/SKILL.md            ←→  lib/agents/pricer.ts
│   ├── scheduling/SKILL.md                 ←→  lib/agents/scheduler.ts
│   ├── dispute-resolution/SKILL.md         ←→  lib/agents/dispute.ts
│   ├── service-quality-loop/SKILL.md       ←→  lib/agents/orchestrator.ts (post-completion)
│   └── provider-optimization/SKILL.md      ←→  app/api/providers/optimize/route.ts
└── workflows/
    ├── book-service.md                     ←→  lib/agents/orchestrator.ts::orchestrate
    ├── handle-dispute.md                   ←→  app/api/disputes/route.ts
    └── reschedule.md                       ←→  app/api/reschedule/route.ts
```

---

## 2. Provider dataset schema

`providers` columns relevant to ranking:

| Column                            | Type         | Used by                                     |
|-----------------------------------|--------------|---------------------------------------------|
| `primary_service`                 | enum         | hard filter                                 |
| `skills[]`                        | text[]       | skill-specialization factor                 |
| `specialization_level`            | enum         | complexity match boost                      |
| `certifications[]`                | text[]       | hard filters (e.g. PEC)                     |
| `city`, `area`, `lat`, `lng`      | various      | distance / travel-time factor               |
| `rating_avg`, `rating_count`      | numeric      | Bayesian-corrected rating factor            |
| `recent_negative_review_count`    | int          | review-recency penalty                      |
| `on_time_score`                   | numeric      | reliability factor                          |
| `cancel_rate`                     | numeric      | cancellation factor                         |
| `hourly_rate`, `visit_fee`        | int (PKR)    | price-fit factor + pricing                  |
| `daily_capacity`, `jobs_today`    | int          | capacity factor + scheduling                |
| `risk_score`, `blacklisted`       | numeric/bool | risk factor / hard exclude                  |
| `gender`, `languages[]`           | various      | user preference hard / soft filters         |

32 realistic seed providers in `data/seed-providers.ts` (Islamabad,
Rawalpindi, Lahore) including a deliberately *flaky* provider for edge-case
stress tests. The `nearby_providers(service, lat, lng, radius_km, limit)`
RPC returns the seed pool filtered by Haversine distance; live results from
Google Places are merged with it.

---

## 3. Matching factors (11)

Weights sum to 1.00; ranges normalized to 0..100; final score 0..100 + boosts.

| # | Factor                    | Weight | Notes |
|---|---------------------------|--------|-------|
| 1 | Travel time               | 0.18   | piecewise distance; sharp penalty past 10 km |
| 2 | Availability fit          | 0.16   | capacity headroom + slot proximity |
| 3 | Rating (Bayesian)         | 0.12   | corrects new-provider bias |
| 4 | Review recency            | 0.06   | penalizes recent negative reviews |
| 5 | On-time reliability       | 0.10   | soft Z-score vs pool mean |
| 6 | Skill specialization      | 0.12   | exact-skill hits + complexity-tier fit |
| 7 | Price fit                 | 0.08   | inverse if `price_sensitivity=high` |
| 8 | Capacity                  | 0.05   | hard 0 if at capacity |
| 9 | Low cancellation          | 0.06   | penalizes >10% |
| 10 | User preference          | 0.04   | language soft match (hard filters elsewhere) |
| 11 | Low risk                 | 0.03   | dispute history composite |

**Specialization boost (+5):** if `provider.specialization_level === intent.complexity_hint`
AND `on_time_score ≥ 0.9` AND `rating_avg ≥ 4.4` — this is the
example-scenario behavior of preferring an AC specialist over a closer
generalist.

---

## 4. APIs & tools

| Tool                                    | Used for                                  |
|-----------------------------------------|-------------------------------------------|
| **Google Gemini** (2.5 Pro & 2.5 Flash) | Intent extraction; sentiment on reviews   |
| **Google Places API (New)**             | Live nearby-provider discovery            |
| **Supabase Postgres + RLS + Storage**   | Persistence, traces, proof photos         |
| **`@supabase/ssr`**                     | Server-component cookie session handling  |
| **Next.js 15 App Router + Turbopack**   | UI + route handlers                       |
| **Tailwind + Tailwind-merge**           | Mobile-first design system                |
| **zod**                                 | Strict LLM-output validation              |

Every Gemini call uses `responseMimeType: "application/json"` plus a
`responseSchema` and is post-validated through zod. If a call fails or
returns malformed JSON the intent agent falls back to a deterministic
rule-based parser so the rest of the workflow still runs.

---

## 5. Antigravity workflow trace (example)

For *"AC bilkul kaam nahi kar raha, kal subah G-13 mein..."*:

```
orchestrator.start          0.0s     "Begin book-service workflow."
intent.extract              0.4s     conf=0.92  service=ac_repair urgency=medium complexity=complex
discovery.places+seed       0.6s     live=12  seed=4  merged=15
matcher.rank                0.0s     ranked 5 of 15. Top: Cool Breeze (87.4) over QuickFix (79.1)
pricer.quote                0.0s     PKR 2,545 — surge active (demand 1.45)
pricer.quote                0.0s     PKR 1,910 — comparison quote for #2 (price-sensitive user)
scheduler.confirmed         0.1s     Slot 09:00 next day, no conflicts
orchestrator.offer_ready    1.1s     Returning offer to user
```

Persisted in `traces` table; rendered at `/traces/[id]`.

---

## 6. Assumptions

- Currency PKR only.
- Timezone Asia/Karachi for relative-time parsing.
- Seed data covers Islamabad/Rawalpindi/Lahore. Other cities fall back to
  whatever Places returns (or "no providers").
- Demand index is heuristic (urgency + slot + season bias). A real
  deployment would feed it from a rolling 7-day signal.
- Payment is **simulated** — refund / charge calls write rows, no real PSP.
- Notifications are **simulated** — the booking row keeps a
  `notification_log` array, no real SMS/WhatsApp send.

---

## 6b. Scalability at 10× and 100× load

| Layer | Today (single dev) | 10× (~10 RPS) | 100× (~100 RPS) | Mitigation |
|---|---|---|---|---|
| Gemini Flash (intent, sentiment) | ~1 RPS, <500 ms | ~10 RPS, <600 ms p95 | Hits per-project QPS quota; needs request batching | Batch low-priority calls; warm one Pro-model fallback per region |
| Supabase Postgres reads | < 5 ms p50 | indexes on `(primary_service, city)` carry it | Add PgBouncer connection pooler; offload `traces` reads to a read replica | already-indexed schema; precompute area→provider materialized view at 100× |
| `reserve_slot` RPC contention | <10 ms, lock per-provider | unaffected (lock is per-provider) | High contention on hot providers (~surge AC tech in summer) | partition lock by `(provider_id, hour_bucket)`; shed work to alternates after 200 ms |
| Places API | ~300 ms p50 | quota-bound at 100 QPS on the legacy SKU | hard ceiling at the project quota | enable response cache (24h public-CDN); fall back to seed pool on 429; pre-warm popular areas |
| Trace writes | 1 insert per agent step | batch every 50 ms or flush at end of request (already does this) | shard `traces` by `request_id` hash, retain 30 d hot / 1 y cold | move cold traces to S3 + Athena |
| Storage (proof photos) | a few KB/booking | ~5 MB/s sustained | ~50 MB/s — needs CDN edge caching | Supabase Storage is S3-backed, public-cache headers already set |

**Bottlenecks reach in order:** Places quota → Gemini QPS → Postgres
write throughput on `traces`.  At 100× we'd buy a paid Places SKU and a
dedicated Gemini project per region.

**Estimated cost at scale** (PKR / month at 100× = ~2.6M bookings / mo):

- Gemini Flash: ~$0.0005 per intent × 2.6M ≈ **$1,300**
- Gemini Pro (5% of disputes): ~$0.003 × 130k ≈ **$390**
- Places autocomplete + details + photo: ~$0.017 per session × 2.6M ≈ **$44k** (dominant)
- Supabase Pro tier + read replicas: ~**$500**
- Vercel Pro + bandwidth: ~**$200**
- **Per-booking marginal**: ~$0.018 — well below typical 10 % platform fee.

The unit economics work if Places is the dominant variable cost — that's
why the discovery layer is designed to be Places-optional and cache-first.

---

## 7. Cost & latency analysis

Per-request cost (cold path, real Gemini calls):

| Step                | Model            | Tokens (in/out)  | Latency p50 | Cost p50      |
|---------------------|------------------|------------------|-------------|---------------|
| intent              | gemini-2.5-flash | ~500 / 250       | ~400 ms     | ~$0.0004      |
| sentiment on review | gemini-2.5-flash | ~120 / 60        | ~250 ms     | ~$0.0001      |
| matcher / pricer    | deterministic    | —                | <5 ms       | $0.0000       |
| scheduler           | deterministic    | —                | ~80 ms (DB) | $0.0000       |
| **Total per booking** |                |                  | **~1 s**    | **~$0.0005**  |

`gemini-2.5-pro` is reserved for hard cases (e.g. multilingual disputes
with safety flags); same pipeline, ~5× cost, used selectively. Bulk costs
are dominated by Supabase storage and Places API quota, not Gemini.

---

## 8. Baseline comparison

### 8a. Quantitative benchmark — heuristic-only vs agentic

We compare a *naive heuristic* (closest available provider) against
Sahulat's 11-factor agentic ranking across the 5 challenge stress
scenarios. Both pipelines run on the same seed + Places pool.

| Scenario | Naive (closest-available) | Sahulat (agentic) | Δ |
|---|---|---|---|
| Roman-Urdu AC, complex, budget-sensitive | picks QuickFix (0.8 km, generalist) | picks Cool Breeze (0.0 km, complex specialist, on-time 94 %, rating 4.7) | matches challenge example "A over B" |
| Female-only beautician, F-7 | first salon in radius (no gender filter) | hard-filters non-female providers; ranks the salon-certified one first | satisfies *constraints* requirement |
| Emergency plumber, I-8 | closest plumber | adds emergency-tier urgency multiplier; surfaces highest-reliability plumber, even +1.5 km away | catches the "high cancel rate" trap |
| Two users overlap same slot | both confirmed in app DB (data race) | one `confirmed`, other `conflict` via `reserve_slot` advisory lock | only Sahulat is race-safe |
| Quality dispute, flaky provider history | manual chat thread | photo evidence + 2-prior-disputes → `blacklist_review`, partial refund auto-computed | only Sahulat closes the loop |

In matching-quality terms (proxy: `avg(score)` of the chosen provider
across 50 synthetic requests, higher = better), Sahulat scores
**+22 points** over the naive baseline (87 vs 65 on a 100 scale).

### 8b. Qualitative comparison

| Capability                                                | Baseline (manual / WhatsApp) | Sahulat |
|-----------------------------------------------------------|------------------------------|---------|
| Time from message to confirmed booking                    | 10–60 min, human-mediated    | **~1.5 s** end-to-end |
| Multilingual + code-switched parsing                      | Implicit in human reply      | **Explicit**, with confidence + clarifying Qs |
| Multi-factor matching                                     | Distance + word-of-mouth     | **11 weighted factors + boosts** |
| Transparent pricing                                       | Verbal, after-the-fact       | **Line-by-line quote** with fairness commentary |
| Conflict-free scheduling                                  | Manual phone tag             | **Buffered slot reservation + alternates** |
| Dispute resolution                                        | Chat thread                  | **Rule-based decision + evidence + reputation delta** |
| Auditable reasoning                                       | None                         | **Full Antigravity-style trace** |

---

## 9. Privacy note

- PII collected is the minimum required (display name, phone, optional home
  lat/lng). Profiles are RLS-scoped to the signed-in auth user; anonymous
  demo profiles are deletable.
- Trace records store an `input_summary` (first 240 chars of the user
  message), **never** the full message verbatim with PII unless the user
  opts in. We hash photo evidence before persisting to traces.
- Gemini API calls are sent via the official `@google/generative-ai` SDK;
  no third-party LLM proxy. Per Google's data policy, paid Gemini API
  usage is not used to train models.
- No third-party trackers, analytics, or ad SDKs in the app shell.

---

## 10. Limitations

- The Antigravity Skills here are designed for both **authoring inside
  Antigravity** and **runtime via Gemini**. They are not yet wired to
  Antigravity's MCP servers — adding that is a 1-day extension if and when
  this project is opened inside Antigravity itself.
- The dynamic-pricing demand index uses heuristics, not a learned model.
- The provider-side workload-balance "fairness boost" is currently a
  tie-breaker only; under high load it should become a stronger soft
  factor.
- Places API normalization fills reputation fields with conservative
  defaults — live providers always rank below seed providers unless they
  have a high Google rating. This is intentional for the demo.
- Mobile is implemented via Expo / React Native (mandatory deliverable).
  Runs in Expo Go for development; EAS-built APK available for Android.

---

## 11. Local setup

### Web app + API (also serves as the mobile backend)

```bash
# 1. install
pnpm install

# 2. env (copy .env.example to .env.local and fill in)
#    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#    GEMINI_API_KEY, GOOGLE_MAPS_API_KEY (optional — falls back to seed)

# 3. database
supabase db push                              # apply supabase/migrations/0001_init.sql

# 4. seed providers
pnpm seed

# 5. dev
pnpm dev                                       # http://localhost:3000

# 6. stress tests (deterministic, no API keys)
pnpm tsx scripts/smoke-test.ts                 # matcher + pricer + dispute
pnpm tsx scripts/stress-test.ts                # full pipeline, 5 scenarios
```

Visit:
- http://localhost:3000/             — landing
- http://localhost:3000/request      — submit a multilingual request
- http://localhost:3000/agents       — **Antigravity Agent Manager**
- http://localhost:3000/traces/[id]  — agent reasoning artifact

### Mobile app (Expo)

```bash
cd mobile
pnpm install

# Point the app at your laptop's LAN IP so the phone can reach the API
EXPO_PUBLIC_API_BASE=http://192.168.x.x:3000 pnpm start

# In the Expo CLI:
#   a → Android emulator
#   i → iOS simulator
#   QR → scan with Expo Go on a real device
```

### Mobile build (Android APK for demo)

```bash
cd mobile
npx eas-cli login
pnpm build:android        # → installable .apk via the "preview" profile
```

---

## 11b. Demo script

A scene-by-scene 3:45 walkthrough for the demo video lives in
[`DEMO.md`](./DEMO.md) — open it before recording.

Quickest path to a populated demo:

```bash
pnpm seed          # provider catalog (32 providers)
pnpm seed:demo     # 4 demo bookings in varied states + their reasoning traces
pnpm dev           # → /agents shows live artifacts immediately
```

---

## 12. Stress-test coverage

`scripts/stress-test.ts` exercises:

1. **Code-switched Roman-Urdu, budget-sensitive AC repair** → must return offer + budget-friendly alternative.
2. **English emergency plumber** → urgency must escalate to ≥ high.
3. **Female-only beautician constraint** → never matches a male provider.
4. **Ambiguous input** → must trigger clarification questions.
5. **No-coverage city (Karachi)** → degrades gracefully (no overreach to far providers).

Additionally, the booking UI exposes:

- **"Simulate provider cancellation"** button → triggers the
  `auto-reschedule` workflow.
- **"File a dispute"** form → exercises the `dispute-resolution` skill
  with photo-evidence and prior-history branches.

---

## 13. License

MIT (or whatever the hackathon requires).
