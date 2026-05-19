---
name: reschedule
description: Triggered when a provider cancels a confirmed booking. Finds next-best provider and offers the same slot or alternates.
---

# Workflow: Auto-Reschedule

1. Load original `match_trace` for the booking to recover ranking and intent.
2. Mark cancelled provider's reliability score `-5` and log cancellation reason.
3. Walk down the original ranking from rank 2 → 5; for each:
   - check availability for the original slot via `scheduling` skill.
   - if free → reserve & confirm; notify user with rationale ("Provider X cancelled; rebooked with Provider Y at the same time").
4. If none free → propose top 2 alternates ranked by `score - distance(slot_shift)`.
5. If the customer rejects all alternates → refund any holds and surface waitlist option.
