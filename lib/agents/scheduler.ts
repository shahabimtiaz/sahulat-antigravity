import { getAdminSupabase } from "@/lib/supabase/server";
import type { Intent, RankedProvider, ScheduleResult } from "./types";
import type { TraceCollector } from "./trace";
import { getCachedProvenance, getSkillProvenance } from "./skill-loader";

getSkillProvenance("scheduling").catch(() => undefined);

const TRAVEL_BUFFER_MIN = 20;
const DEFAULT_DURATION_MIN = 60;
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function pakistanWallTime(now: Date, dayOffset: number, hour: number, minute = 0): Date {
  const pktNow = new Date(now.getTime() + PAKISTAN_OFFSET_MS);
  return new Date(Date.UTC(
    pktNow.getUTCFullYear(),
    pktNow.getUTCMonth(),
    pktNow.getUTCDate() + dayOffset,
    hour,
    minute,
    0,
    0,
  ) - PAKISTAN_OFFSET_MS);
}

function resolveRequestedSlot(intent: Intent, now = new Date()): Date {
  if (intent.time.iso) return new Date(intent.time.iso);
  switch (intent.time.kind) {
    case "asap": return new Date(now.getTime() + 60 * 60_000);
    case "today": return new Date(now.getTime() + 3 * 60 * 60_000);
    case "tomorrow_morning": return pakistanWallTime(now, 1, 9);
    case "tomorrow_afternoon": return pakistanWallTime(now, 1, 14);
    case "tomorrow_evening": return pakistanWallTime(now, 1, 18);
    default: return new Date(now.getTime() + 2 * 60 * 60_000);
  }
}

type ScheduleOpts = {
  intent: Intent;
  ranking: RankedProvider[];
  duration_min?: number;
  now?: Date;
  trace: TraceCollector;
};

export async function scheduleBooking({ intent, ranking, duration_min = DEFAULT_DURATION_MIN, now = new Date(), trace }: ScheduleOpts): Promise<ScheduleResult> {
  const t0 = Date.now();
  const supabase = getAdminSupabase();
  const requestedStart = resolveRequestedSlot(intent, now);
  const requestedEnd = new Date(requestedStart.getTime() + duration_min * 60_000);
  const bufferMs = TRAVEL_BUFFER_MIN * 60_000;

  if (!ranking.length) {
    return ret({
      status: "no_capacity",
      conflicts_considered: [],
      rationale: "No providers in ranking to schedule with.",
    });
  }

  const conflictsConsidered: Array<{ booking_id: string; reason: string }> = [];

  // Try providers in rank order.
  for (const r of ranking) {
    if (!isUuid(r.provider_id)) {
      conflictsConsidered.push({ booking_id: "unpersisted_provider", reason: `${r.name} came from a live source but is not persisted for booking.` });
      trace.push({
        agent: "scheduler",
        step: "skip_unbookable_provider",
        rationale: `${r.name} has non-UUID provider_id ${r.provider_id}; skipping to keep confirmation atomic.`,
        latency_ms: Date.now() - t0,
      });
      continue;
    }

    // Fetch confirmed bookings for the provider on the requested day.
    const dayStart = new Date(requestedStart); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedStart); dayEnd.setHours(23, 59, 59, 999);
    const { data: existing, error } = await supabase
      .from("bookings")
      .select("id, scheduled_start, scheduled_end, status")
      .eq("provider_id", r.provider_id)
      .gte("scheduled_start", dayStart.toISOString())
      .lte("scheduled_start", dayEnd.toISOString())
      .in("status", ["confirmed", "en_route", "in_progress"]);

    if (error) {
      trace.push({
        agent: "scheduler",
        step: "fetch_existing",
        rationale: `DB error: ${error.message}`,
        latency_ms: Date.now() - t0,
      });
      continue;
    }

    const overlap = (existing ?? []).find((b) => {
      if (!b.scheduled_start || !b.scheduled_end) return false;
      const bs = new Date(b.scheduled_start).getTime();
      const be = new Date(b.scheduled_end).getTime();
      const rs = requestedStart.getTime() - bufferMs;
      const re = requestedEnd.getTime() + bufferMs;
      return bs < re && be > rs;
    });

    if (overlap) {
      conflictsConsidered.push({ booking_id: overlap.id, reason: `${r.name} double-booked at requested slot.` });
      continue; // try next provider
    }

    // Found a free provider — return as confirmed.
    return ret({
      status: "confirmed",
      slot: {
        start: requestedStart.toISOString(),
        end: requestedEnd.toISOString(),
        provider_id: r.provider_id,
      },
      conflicts_considered: conflictsConsidered,
      rationale: conflictsConsidered.length
        ? `Top-ranked providers had conflicts; ${r.name} accepted the requested slot.`
        : `Top-ranked provider ${r.name} accepted the requested slot at ${requestedStart.toISOString()}.`,
    });
  }

  // All providers conflicted — propose 3 alternates from the top 3.
  const alternates: Array<{ start: string; end: string; provider_id: string; why: string }> = [];
  for (const r of ranking.slice(0, 3)) {
    if (!isUuid(r.provider_id)) continue;
    // earliest slot today after last booking + buffer
    const dayStart = new Date(requestedStart); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedStart); dayEnd.setHours(23, 59, 59, 999);
    const { data: existing } = await supabase
      .from("bookings")
      .select("scheduled_end")
      .eq("provider_id", r.provider_id)
      .gte("scheduled_start", dayStart.toISOString())
      .lte("scheduled_start", dayEnd.toISOString())
      .in("status", ["confirmed", "en_route", "in_progress"])
      .order("scheduled_end", { ascending: false })
      .limit(1);
    const lastEnd = existing?.[0]?.scheduled_end ? new Date(existing[0].scheduled_end) : null;
    const candidate = lastEnd
      ? new Date(lastEnd.getTime() + bufferMs)
      : new Date(requestedStart.getTime() + 90 * 60_000);
    const candEnd = new Date(candidate.getTime() + duration_min * 60_000);
    alternates.push({
      start: candidate.toISOString(),
      end: candEnd.toISOString(),
      provider_id: r.provider_id,
      why: `${r.name} available ${Math.round((candidate.getTime() - requestedStart.getTime()) / 60_000)} min after originally requested time.`,
    });
  }

  return ret({
    status: "alternates_offered",
    alternates,
    conflicts_considered: conflictsConsidered,
    rationale: `All top-ranked providers were busy at ${requestedStart.toISOString()}. Offering ${alternates.length} alternates.`,
  });

  function ret(res: ScheduleResult): ScheduleResult {
    trace.push({
      agent: "scheduler",
      step: res.status,
      input_summary: `requestedStart=${requestedStart.toISOString()} duration=${duration_min}m buffer=${TRAVEL_BUFFER_MIN}m`,
      output: res,
      rationale: res.rationale,
      latency_ms: Date.now() - t0,
      skill: getCachedProvenance("scheduling"),
    });
    return res;
  }
}
