---
name: scheduling
description: Use when confirming a booking slot. Prevents double-booking, includes travel-time buffers, suggests alternates, manages waitlist, and auto-reschedules when a provider cancels.
---

# Skill: Scheduling Intelligence

## Goal
Atomic, race-safe slot assignment with explicit alternates when the first choice fails.

## Inputs
- `provider_id`, `requested_slot` (ISO start), `duration_min`, `customer_location`
- `provider.travel_buffer_min` (default 20)

## Procedure
1. Fetch provider's existing confirmed bookings for the target day (`status in ('confirmed','en_route','in_progress')`).
2. Compute `effective_window = [requested_slot - buffer, requested_slot + duration + buffer]`.
3. If `effective_window` overlaps any existing booking → propose 3 alternates:
   - earliest slot today after last existing booking + buffer.
   - earliest slot next day morning.
   - second-best provider's requested slot.
4. If no conflict → reserve via Postgres transaction with `SELECT ... FOR UPDATE` on the provider row.
5. On provider cancellation event → trigger `auto-reschedule` workflow:
   - find next-best provider from original ranking.
   - try to hold same slot; if not, propose 2 alternates and notify user.
6. Waitlist: when no provider available in the requested window, add user to `waitlist` and watch for openings.

## Output schema
```ts
{
  status: "confirmed" | "alternates_offered" | "waitlisted" | "no_capacity",
  slot?: { start: string, end: string, provider_id: string },
  alternates?: Array<{ start: string, end: string, provider_id: string, why: string }>,
  conflicts_considered: Array<{ booking_id: string, reason: string }>,
  rationale: string
}
```

## Race-safety notes
- Always use Supabase `rpc` or transaction so two concurrent users requesting the same slot get serialized — second receives `alternates_offered`.
- The Antigravity orchestrator must NEVER assume the first provider's slot is free until the scheduler returns `status=confirmed`.
