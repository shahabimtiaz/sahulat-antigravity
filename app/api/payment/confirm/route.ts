/**
 * Simulated payment confirmation.
 *
 * Determinism: amount % 7 === 0 → declined. Otherwise authorized after a
 * 250ms simulated PSP round-trip. The orchestrator surfaces `payment_failed`
 * so the UI can offer retry / pay-on-delivery / alternate provider.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { TraceCollector, newRequestId } from "@/lib/agents/trace";

const Body = z.object({
  booking_id: z.string().uuid(),
  method: z.enum(["card", "jazzcash", "easypaisa", "cod"]).default("card"),
  // Demo control: force a specific outcome.
  force_outcome: z.enum(["auto", "fail", "succeed"]).optional().default("auto"),
});

const FAILURE_REASONS = [
  "card_declined",
  "issuer_unavailable",
  "insufficient_funds",
  "fraud_check_triggered",
];

export async function POST(req: Request) {
  const supabase = getAdminSupabase();
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, total_price, payment_status, payment_attempts")
    .eq("id", parsed.booking_id)
    .single();
  if (error || !booking) return NextResponse.json({ error: "booking not found" }, { status: 404 });

  // Determine outcome.
  const amount = booking.total_price ?? 0;
  let outcome: "succeed" | "fail";
  if (parsed.force_outcome === "fail") outcome = "fail";
  else if (parsed.force_outcome === "succeed") outcome = "succeed";
  else if (parsed.method === "cod") outcome = "succeed"; // cash on delivery never fails at auth time
  else outcome = amount % 7 === 0 ? "fail" : "succeed";

  // simulate PSP latency
  await new Promise((r) => setTimeout(r, 250));

  const attempts = (booking.payment_attempts ?? 0) + 1;
  const trace = new TraceCollector(newRequestId());
  trace.attachBookingId(booking.id);

  if (outcome === "fail") {
    const reason = FAILURE_REASONS[amount % FAILURE_REASONS.length];
    await supabase.from("bookings")
      .update({ payment_status: "failed", payment_attempts: attempts })
      .eq("id", booking.id);

    trace.push({
      agent: "fallback",
      step: "payment_failed",
      output: { reason, attempts, method: parsed.method, amount },
      rationale: `PSP returned ${reason} on attempt ${attempts}. Surfacing retry + cash-on-delivery alternative.`,
      latency_ms: 250,
    });
    await trace.flush();

    return NextResponse.json({
      status: "failed",
      reason,
      attempts,
      retry_allowed: attempts < 3,
      alternatives: ["retry_card", "pay_on_delivery", "switch_provider"],
    }, { status: 402 });
  }

  await supabase.from("bookings")
    .update({ payment_status: "authorized", payment_attempts: attempts })
    .eq("id", booking.id);

  trace.push({
    agent: "booking",
    step: "payment_authorized",
    output: { attempts, method: parsed.method, amount },
    rationale: `Payment authorized via ${parsed.method} on attempt ${attempts}.`,
    latency_ms: 250,
  });
  await trace.flush();

  return NextResponse.json({ status: "authorized", attempts, method: parsed.method });
}
