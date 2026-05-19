import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { TraceCollector } from "@/lib/agents/trace";

const Body = z.object({
  status: z.enum(["en_route", "in_progress", "completed", "cancelled_by_provider", "cancelled_by_user", "no_show"]),
  reason: z.string().optional(),
  proof_photo_urls: z.array(z.string()).optional(),
  completion_checklist: z.record(z.unknown()).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getAdminSupabase();
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const patch: Record<string, unknown> = { status: parsed.status };
  const now = new Date();
  if (parsed.status === "in_progress") patch.actual_start = now.toISOString();
  if (parsed.status === "completed") {
    patch.actual_end = now.toISOString();
    if (parsed.proof_photo_urls) patch.proof_photo_urls = parsed.proof_photo_urls;
    if (parsed.completion_checklist) patch.completion_checklist = parsed.completion_checklist;
    // Compute on-time delta if we have scheduled & actual.
    const { data: b } = await supabase.from("bookings").select("scheduled_start, actual_start").eq("id", id).single();
    if (b?.scheduled_start && b?.actual_start) {
      const delta = Math.round((new Date(b.actual_start).getTime() - new Date(b.scheduled_start).getTime()) / 60_000);
      patch.on_time_delta_min = delta;
    }
  }
  if (parsed.status === "cancelled_by_provider" || parsed.status === "cancelled_by_user") {
    patch.cancellation_reason = parsed.reason ?? null;
    patch.cancelled_by = parsed.status === "cancelled_by_provider" ? "provider" : "user";
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Emit a trace event for the lifecycle transition.
  const trace = new TraceCollector((booking.parsed_intent as { request_id?: string })?.request_id ?? id);
  trace.attachBookingId(id);
  const lifecycleOutput = {
    id,
    status: parsed.status,
    reason: parsed.reason ?? null,
    eta_min: parsed.status === "en_route" ? 12 : undefined,
    proof_count: parsed.proof_photo_urls?.length ?? 0,
    completion_checklist: parsed.completion_checklist ?? null,
  };
  const rationale =
    parsed.status === "en_route"
      ? "Provider marked en route; simulated ETA and progress update recorded for the customer."
      : parsed.status === "completed"
        ? "Service completed; checklist and proof-photo placeholders feed the quality loop."
        : parsed.status.startsWith("cancelled")
          ? `Cancellation recorded with reason: ${parsed.reason ?? "not provided"}.`
          : `Lifecycle transition → ${parsed.status}.`;
  trace.push({
    agent: "quality",
    step: parsed.status,
    output: lifecycleOutput,
    rationale,
  });
  await trace.flush();

  return NextResponse.json({ booking });
}
