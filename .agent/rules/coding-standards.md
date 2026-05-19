---
name: coding-standards
description: Project conventions that all Antigravity agents must follow when generating or modifying code in this workspace.
---

# Coding Standards — Sahulat Service Orchestrator

## Stack
- Next.js 15 (App Router, TypeScript, Server Components by default).
- Tailwind CSS for styling; mobile-first; PWA-installable.
- Supabase (PostgreSQL + RLS) for persistence; `@supabase/ssr` for cookies.
- Google Gemini (`@google/generative-ai`) for agent reasoning. Default `gemini-2.5-pro` for orchestrator/match/dispute; `gemini-2.5-flash` for intent + quick tasks.
- Google Places API (New) for live provider discovery; mock seed data as fallback.
- `zod` for all LLM structured-output schemas; no `any`.

## Agent contract
Every agent step emits a `TraceEvent` (see `lib/agents/trace.ts`) with: `agent`, `step`, `input_summary`, `output`, `confidence`, `latency_ms`, `model`, `rationale`. Traces are persisted to the `traces` table and surfaced at `/traces/[bookingId]`.

## Quality gates
- All agents return structured JSON validated against zod schemas. On invalid output, retry once with a stricter system instruction; on second failure, return a confidence-zero result and trigger fallback.
- Multilingual: assume code-switched Urdu / Roman Urdu / English input. Never translate user-facing text away from the user's input language.
- Never log secrets or full user PII to the trace table — only `input_summary`.
- Booking, pricing, and dispute writes go through server actions with RLS-aware Supabase clients.

## UI
- Mobile-first: every screen must look correct at 360×740 first, desktop second.
- Dark theme only for v1; high-contrast, no purple-on-purple.
- Show agent rationale next to every consequential action (match, price, schedule).
