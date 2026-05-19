import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmBooking } from "@/lib/agents/orchestrator";
import { IntentSchema, type PriceQuote } from "@/lib/agents/types";

const Body = z.object({
  request_id: z.string(),
  profile_id: z.string().uuid().nullable().optional(),
  intent: IntentSchema,
  provider_id: z.string(),
  slot_start: z.string(),
  slot_end: z.string(),
  price_breakdown: z.unknown(),
  request_text: z.string(),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (!parsed.price_breakdown || typeof parsed.price_breakdown !== "object") {
    return NextResponse.json({ error: "price_breakdown is required" }, { status: 400 });
  }
  try {
    const out = await confirmBooking({
      ...parsed,
      price_breakdown: parsed.price_breakdown as PriceQuote,
    });
    if (out.status === "conflict") {
      // 409 — surfaces atomic reservation race so the client can re-offer.
      return NextResponse.json(out, { status: 409 });
    }
    return NextResponse.json(out);
  } catch (e) {
    console.error("confirm error", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
