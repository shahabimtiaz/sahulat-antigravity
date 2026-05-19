---
name: book-service
description: End-to-end orchestration workflow from raw user message to confirmed booking with persisted reasoning trace.
---

# Workflow: Book a Service

Trigger: user submits a free-text request from the chat UI.

## Steps
1. **intent-extraction** — parse the message; if `confidence < 0.75`, return clarifying questions and STOP.
2. **provider-discovery** — call `lib/places/client.ts` for live Google Places results within radius; if it fails or returns <3 candidates, supplement from `providers` table seed.
3. **provider-matching** — run multi-factor scoring; return top 5.
4. **dynamic-pricing** — quote the top provider; also quote #2 for comparison if user is price-sensitive.
5. **scheduling** — attempt slot reservation on top provider; if conflict, surface alternates from step 3.
6. **booking-write** — atomic insert into `bookings` + status `confirmed`.
7. **notifications (simulated)** — log a "would send SMS/WhatsApp" trace event with the rendered message body.
8. **trace-finalize** — flush all `TraceEvent`s for this `request_id`; redirect user to `/bookings/[id]` and link to `/traces/[id]`.

## Failure paths
- No providers → trigger `waitlist` flow.
- All top 3 conflicted slots → present alternates UI.
- Places + DB both empty for service type in area → return apology + offer to alert when available.
