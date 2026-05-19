/**
 * Antigravity-style reasoning traces.
 *
 * Every agent step emits a TraceEvent. Events are accumulated per request_id
 * and flushed to the `traces` table at the end of the orchestration, so the
 * UI can render a clean artifact view at /traces/[bookingId].
 */
import { getAdminSupabase } from "@/lib/supabase/server";

import type { SkillProvenance } from "./skill-loader";

export type TraceEvent = {
  request_id: string;
  agent: "orchestrator" | "intent" | "discovery" | "matcher" | "pricer" | "scheduler" | "booking" | "notification" | "quality" | "dispute" | "fallback";
  step: string;
  input_summary?: string;
  output?: unknown;
  rationale?: string;
  confidence?: number;
  model?: string;
  latency_ms?: number;
  booking_id?: string | null;
  /** Which Antigravity skill (and version hash) drove this run. */
  skill?: SkillProvenance;
};

export class TraceCollector {
  private events: TraceEvent[] = [];
  constructor(readonly request_id: string) {}

  push(ev: Omit<TraceEvent, "request_id">) {
    this.events.push({ ...ev, request_id: this.request_id });
  }

  attachBookingId(id: string) {
    for (const e of this.events) e.booking_id = id;
  }

  list(): TraceEvent[] { return [...this.events]; }

  async flush() {
    if (!this.events.length) return;
    try {
      const supabase = getAdminSupabase();
      const rows = this.events.map((e) => ({
        request_id: e.request_id,
        booking_id: e.booking_id ?? null,
        agent: e.agent,
        step: e.step,
        input_summary: e.input_summary ?? null,
        // Embed skill provenance into output so the existing /traces UI surfaces it
        // without a schema migration. The viewer renders `output` generically.
        output: e.skill ? { ...(typeof e.output === "object" && e.output ? e.output : { value: e.output }), _provenance: e.skill } : e.output ?? null,
        rationale: e.rationale ?? null,
        confidence: e.confidence ?? null,
        model: e.model ?? null,
        latency_ms: e.latency_ms ?? null,
      }));
      const { error } = await supabase.from("traces").insert(rows);
      if (error) console.warn("trace flush failed:", error.message);
    } catch (e) {
      console.warn("trace flush threw:", (e as Error).message);
    }
  }
}

export function newRequestId() {
  return (globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}
