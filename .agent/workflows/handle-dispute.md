---
name: handle-dispute
description: Triggered when a customer or provider files a post-service dispute. Routes through dispute-resolution skill and applies decisions.
---

# Workflow: Handle Dispute

1. Validate dispute is for a completed booking owned by submitter.
2. Gather evidence: completion checklist, proof photos, ratings, payment status, prior disputes for both parties.
3. Run `dispute-resolution` skill → decision payload.
4. Apply effects: refund (mock payment API), reputation delta, blacklist flag, follow-up tasks.
5. Notify both parties with bilingual message body.
6. Persist full trace + evidence pointers.
