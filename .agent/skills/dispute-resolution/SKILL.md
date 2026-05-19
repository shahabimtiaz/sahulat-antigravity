---
name: dispute-resolution
description: Use when a customer reports a no-show, cancellation, quality complaint, price disagreement, overrun, or refund request after service. Decides: refund, compensation, blacklist, or human escalation.
---

# Skill: Dispute & Escalation

## Goal
Fair, evidence-weighted resolution that protects both sides and the platform's reputation graph.

## Dispute taxonomy
- `no_show` — provider didn't arrive within agreed window.
- `late_arrival` — arrived but exceeded buffer + 30min.
- `quality` — work below acceptable standard (with photo evidence).
- `price` — final charge differs from quote without justification.
- `overrun` — service took longer; provider claims extra.
- `cancellation_post_confirm` — either side cancelled after confirmation.

## Inputs
- booking row, completion proof (photos, checklist), customer rating + comment, provider notes, prior dispute history of both, payment status.

## Decision rules
1. **No-show with no provider notice** → full refund, +1 cancellation count on provider, customer credit 100 PKR.
2. **Late >30 min over buffer** → 20% discount on bill, log on provider on-time score.
3. **Quality, photo evidence supports complaint** → partial refund (50–100% depending on severity), provider rating impact, optional re-do credit.
4. **Quality, no photo evidence** → escalate to human review; freeze 50% of payment for 24h.
5. **Price dispute, quoted < charged** → refund delta; provider warning. Three offenses → blacklist.
6. **Overrun, customer agreed** → allow up to +25% with logged approval; otherwise refund excess.
7. **Cancellation-post-confirm (provider)** → trigger auto-reschedule; provider reliability score −5; if rate >10% → temporary suspension.
8. **Cancellation-post-confirm (customer, within 1h of slot)** → 30% fee retained as provider compensation.

## Escalation triggers
- Same provider, ≥2 quality disputes in 30 days with photo evidence → blacklist review.
- Customer with ≥3 disputes in 30 days against different providers → flag account.
- Any case involving safety / harassment → immediate human escalation, freeze related bookings.

## Output schema
```ts
{
  case_type: "no_show" | "late_arrival" | "quality" | "price" | "overrun" | "cancellation_post_confirm",
  decision: "refund_full" | "refund_partial" | "credit" | "compensate_provider" | "warn" | "blacklist_review" | "human_escalate",
  refund_amount?: number,
  reputation_delta: { customer: number, provider: number },
  follow_ups: string[],
  rationale: string,
  evidence_used: string[]
}
```

## Always
- Communicate decision to both parties in their preferred language.
- Persist trace including evidence file hashes.
