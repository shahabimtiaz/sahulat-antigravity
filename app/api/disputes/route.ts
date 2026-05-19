import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { resolveDispute, type DisputeCase } from "@/lib/agents/dispute";
import { TraceCollector, newRequestId } from "@/lib/agents/trace";

const Body = z.object({
  booking_id: z.string(),
  raised_by: z.enum(["user", "provider"]),
  case_type: z.enum(["no_show", "late_arrival", "quality", "price", "overrun", "cancellation_post_confirm"]),
  description: z.string().max(2000).optional().default(""),
  evidence_urls: z.array(z.string()).optional().default([]),
});

const SAFETY_RE = /(harass|assault|threat|safety|unsafe|misbehav)/i;

export async function POST(req: Request) {
  const supabase = getAdminSupabase();
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id,total_price,on_time_delta_min,proof_photo_urls,cancelled_by,actual_start,actual_end,scheduled_start,provider_id,profile_id,rating,rating_comment")
    .eq("id", parsed.booking_id)
    .single();
  if (error || !booking) return NextResponse.json({ error: "booking not found" }, { status: 404 });

  // Historic dispute counts (30d), scoped through each party's recent bookings.
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let provDisp = 0;
  let custDisp = 0;
  if (booking.provider_id) {
    const { data: providerBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("provider_id", booking.provider_id)
      .gte("created_at", since);
    const ids = (providerBookings ?? []).map((b) => b.id).filter(Boolean);
    if (ids.length) {
      const { count } = await supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .in("booking_id", ids);
      provDisp = count ?? 0;
    }
  }
  if (booking.profile_id) {
    const { data: customerBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("profile_id", booking.profile_id)
      .gte("created_at", since);
    const ids = (customerBookings ?? []).map((b) => b.id).filter(Boolean);
    if (ids.length) {
      const { count } = await supabase
        .from("disputes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .in("booking_id", ids);
      custDisp = count ?? 0;
    }
  }

  const trace = new TraceCollector(newRequestId());
  trace.attachBookingId(parsed.booking_id);

  const decision = resolveDispute({
    case_type: parsed.case_type as DisputeCase,
    booking: {
      id: booking.id,
      total_price: booking.total_price ?? 0,
      on_time_delta_min: booking.on_time_delta_min,
      proof_photo_urls: booking.proof_photo_urls ?? [],
      cancelled_by: booking.cancelled_by ?? null,
      actual_start: booking.actual_start ?? null,
      actual_end: booking.actual_end ?? null,
      scheduled_start: booking.scheduled_start ?? null,
    },
    customer_rating: booking.rating ?? undefined,
    customer_comment: booking.rating_comment ?? undefined,
    provider_prior_disputes_30d: provDisp,
    customer_prior_disputes_30d: custDisp,
    safety_flag: SAFETY_RE.test(parsed.description),
  }, trace);

  const { data: dispute, error: insErr } = await supabase
    .from("disputes")
    .insert({
      booking_id: parsed.booking_id,
      raised_by: parsed.raised_by,
      case_type: parsed.case_type,
      evidence_urls: parsed.evidence_urls,
      description: parsed.description,
      decision: decision.decision,
      refund_amount: decision.refund_amount,
      reputation_delta: decision.reputation_delta,
      status: decision.decision === "human_escalate" ? "escalated"
            : decision.decision === "blacklist_review" ? "under_review"
            : "resolved",
      resolved_at: decision.decision === "human_escalate" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Apply reputation delta to provider.
  if (booking.provider_id && decision.reputation_delta.provider !== 0) {
    const { data: p } = await supabase.from("providers")
      .select("on_time_score, cancel_rate, risk_score, blacklisted")
      .eq("id", booking.provider_id).single();
    if (p) {
      const onTimeDelta = decision.reputation_delta.provider / 100;
      await supabase.from("providers").update({
        on_time_score: Math.max(0, Math.min(1, p.on_time_score + onTimeDelta)),
        risk_score: Math.max(0, Math.min(1, p.risk_score - decision.reputation_delta.provider / 100)),
        blacklisted: p.blacklisted || decision.follow_ups.includes("blacklist_review") && provDisp >= 2,
      }).eq("id", booking.provider_id);
    }
  }

  // Flip booking status.
  await supabase.from("bookings").update({ status: "disputed" }).eq("id", parsed.booking_id);

  await trace.flush();
  return NextResponse.json({ dispute_id: dispute?.id, decision });
}
