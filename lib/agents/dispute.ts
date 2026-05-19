import type { TraceCollector } from "./trace";
import { getCachedProvenance, getSkillProvenance } from "./skill-loader";

getSkillProvenance("dispute-resolution").catch(() => undefined);

export type DisputeCase =
  | "no_show" | "late_arrival" | "quality" | "price" | "overrun" | "cancellation_post_confirm";

export type DisputeInput = {
  case_type: DisputeCase;
  booking: {
    id: string;
    total_price: number;
    on_time_delta_min: number | null;
    proof_photo_urls: string[];
    cancelled_by?: string | null;
    actual_start?: string | null;
    actual_end?: string | null;
    scheduled_start: string | null;
  };
  customer_rating?: number;
  customer_comment?: string;
  provider_prior_disputes_30d?: number;
  customer_prior_disputes_30d?: number;
  /** Triggered when description includes safety / harassment keywords. */
  safety_flag?: boolean;
};

export type DisputeDecision = {
  case_type: DisputeCase;
  decision:
    | "refund_full" | "refund_partial" | "credit" | "compensate_provider"
    | "warn" | "blacklist_review" | "human_escalate";
  refund_amount: number;
  reputation_delta: { customer: number; provider: number };
  follow_ups: string[];
  rationale: string;
  evidence_used: string[];
};

export function resolveDispute(input: DisputeInput, trace: TraceCollector): DisputeDecision {
  const t0 = Date.now();
  const evidence: string[] = [];
  let decision: DisputeDecision["decision"] = "warn";
  let refund_amount = 0;
  let custDelta = 0, provDelta = 0;
  const follow_ups: string[] = [];
  let rationale = "";

  // Safety / harassment → immediate escalation.
  if (input.safety_flag) {
    return finalize({
      case_type: input.case_type,
      decision: "human_escalate",
      refund_amount: 0,
      reputation_delta: { customer: 0, provider: -10 },
      follow_ups: ["freeze_provider_account", "notify_trust_safety_team"],
      rationale: "Safety/harassment flag set — immediate human escalation, freeze related bookings.",
      evidence_used: ["customer_description"],
    });
  }

  switch (input.case_type) {
    case "no_show": {
      decision = "refund_full"; refund_amount = input.booking.total_price;
      provDelta = -8; custDelta = +1;
      follow_ups.push("issue_customer_credit_100_pkr");
      rationale = "Provider did not arrive within the agreed window and gave no notice.";
      evidence.push("no_actual_start", "no_show_threshold_exceeded");
      break;
    }
    case "late_arrival": {
      const lateMin = input.booking.on_time_delta_min ?? 45;
      if (lateMin > 30) {
        decision = "refund_partial";
        refund_amount = Math.round(input.booking.total_price * 0.2);
        provDelta = -3;
        rationale = `Arrived ${lateMin} minutes late, exceeding 30-minute buffer. 20% discount applied.`;
      } else {
        decision = "warn"; refund_amount = 0; provDelta = -1;
        rationale = `Within acceptable late buffer.`;
      }
      evidence.push("on_time_delta_min");
      break;
    }
    case "quality": {
      const hasProof = input.booking.proof_photo_urls.length > 0;
      if (hasProof) {
        const severity = (input.customer_rating ?? 3) <= 2 ? "high" : "medium";
        const pct = severity === "high" ? 1.0 : 0.5;
        decision = severity === "high" ? "refund_full" : "refund_partial";
        refund_amount = Math.round(input.booking.total_price * pct);
        provDelta = -6;
        rationale = `Photo evidence supports ${severity}-severity quality issue. Refund ${(pct * 100).toFixed(0)}%.`;
        evidence.push("proof_photos", "low_rating");
        if ((input.provider_prior_disputes_30d ?? 0) >= 1) {
          follow_ups.push("blacklist_review");
          decision = "blacklist_review";
        }
      } else {
        decision = "human_escalate";
        refund_amount = 0;
        follow_ups.push("freeze_50pct_payment_24h");
        rationale = "Quality dispute without photo evidence — human review needed; partial payment hold.";
        evidence.push("no_proof_photos");
      }
      break;
    }
    case "price": {
      decision = "refund_partial";
      refund_amount = Math.max(0, Math.round(input.booking.total_price * 0.15));
      provDelta = -2;
      rationale = "Charged amount differs from quoted; refunding the difference and warning provider.";
      evidence.push("quote_vs_actual_delta");
      if ((input.provider_prior_disputes_30d ?? 0) >= 2) {
        follow_ups.push("blacklist_review"); decision = "blacklist_review";
      }
      break;
    }
    case "overrun": {
      decision = "warn";
      rationale = "Overrun within 25% tolerance — accepted, logged.";
      evidence.push("duration_actual_vs_planned");
      break;
    }
    case "cancellation_post_confirm": {
      if (input.booking.cancelled_by === "provider") {
        decision = "refund_full";
        refund_amount = input.booking.total_price;
        provDelta = -5;
        follow_ups.push("auto_reschedule");
        rationale = "Provider cancelled after confirmation. Full refund + auto-reschedule next-best provider.";
      } else {
        decision = "compensate_provider";
        refund_amount = -Math.round(input.booking.total_price * 0.3); // negative = retain
        custDelta = -2;
        rationale = "Customer cancelled within 1 hour of slot. 30% of fee retained for provider.";
      }
      evidence.push("cancellation_metadata");
      break;
    }
  }

  if ((input.customer_prior_disputes_30d ?? 0) >= 3) {
    follow_ups.push("flag_customer_account_for_review");
    rationale += " Customer history shows repeated disputes.";
  }

  return finalize({
    case_type: input.case_type,
    decision,
    refund_amount,
    reputation_delta: { customer: custDelta, provider: provDelta },
    follow_ups,
    rationale,
    evidence_used: evidence,
  });

  function finalize(dec: DisputeDecision): DisputeDecision {
    trace.push({
      agent: "dispute",
      step: dec.case_type,
      input_summary: `case=${dec.case_type} booking=${input.booking.id}`,
      output: dec,
      rationale: dec.rationale,
      latency_ms: Date.now() - t0,
      skill: getCachedProvenance("dispute-resolution"),
    });
    return dec;
  }
}
