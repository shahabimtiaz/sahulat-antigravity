import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { discoverProviders } from "@/lib/places/client";
import { matchProviders } from "@/lib/agents/matcher";
import { scheduleBooking } from "@/lib/agents/scheduler";
import { TraceCollector, newRequestId } from "@/lib/agents/trace";
import { IntentSchema } from "@/lib/agents/types";

const Body = z.object({ booking_id: z.string() });

export async function POST(req: Request) {
  const supabase = getAdminSupabase();
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.booking_id)
    .single();
  if (!booking) return NextResponse.json({ error: "booking not found" }, { status: 404 });

  const intent = IntentSchema.parse(booking.parsed_intent);
  const trace = new TraceCollector(newRequestId());
  trace.attachBookingId(parsed.booking_id);
  trace.push({
    agent: "orchestrator",
    step: "reschedule_start",
    rationale: "Provider cancelled — running reschedule workflow.",
  });

  // 1. Penalize cancelled provider.
  if (booking.provider_id) {
    const { data: p } = await supabase.from("providers")
      .select("on_time_score, cancel_rate").eq("id", booking.provider_id).single();
    if (p) {
      await supabase.from("providers").update({
        on_time_score: Math.max(0, p.on_time_score - 0.05),
        cancel_rate: Math.min(1, p.cancel_rate + 0.02),
      }).eq("id", booking.provider_id);
    }
  }

  // 2. Find next-best provider, skipping the cancelled one.
  const candidates = await discoverProviders({
    service: intent.service_type,
    lat: intent.location.lat ?? 33.6844,
    lng: intent.location.lng ?? 73.0479,
    radius_m: 12_000,
  }, trace);
  const filtered = candidates.filter((p) => p.id !== booking.provider_id);
  const { ranking } = await matchProviders({
    intent, candidates: filtered, customerLocation: {
      lat: intent.location.lat ?? 33.6844, lng: intent.location.lng ?? 73.0479
    }, trace,
  });

  if (!ranking.length) {
    await supabase.from("bookings").update({ status: "cancelled_by_provider" }).eq("id", parsed.booking_id);
    trace.push({ agent: "orchestrator", step: "reschedule_failed", rationale: "No alternative providers." });
    await trace.flush();
    return NextResponse.json({ ok: false, reason: "no_alternative_providers" });
  }

  // 3. Try to keep the same slot.
  const schedule = await scheduleBooking({
    intent: { ...intent, time: { ...intent.time, iso: booking.scheduled_start ?? intent.time.iso } },
    ranking,
    trace,
  });

  if (schedule.status === "confirmed") {
    await supabase.from("bookings").update({
      provider_id: schedule.slot.provider_id,
      scheduled_start: schedule.slot.start,
      scheduled_end: schedule.slot.end,
      status: "confirmed",
      cancellation_reason: `auto_reschedule_after_provider_cancel`,
    }).eq("id", parsed.booking_id);
    trace.push({
      agent: "orchestrator",
      step: "rescheduled",
      output: { new_provider_id: schedule.slot.provider_id, slot: schedule.slot },
      rationale: "Rebooked with next-best provider at the same slot.",
    });
    await trace.flush();
    return NextResponse.json({ ok: true, reschedule: schedule });
  }

  // 4. Offer alternates.
  await trace.flush();
  return NextResponse.json({ ok: true, reschedule: schedule });
}
