import { NextResponse } from "next/server";
import { z } from "zod";
import { orchestrate } from "@/lib/agents/orchestrator";

const Body = z.object({
  message: z.string().min(2).max(2000),
  profile_id: z.string().uuid().nullable().optional(),
  loyalty_tier: z.enum(["new", "regular", "loyal"]).optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    const result = await orchestrate(parsed);
    return NextResponse.json(result);
  } catch (e) {
    console.error("orchestrate error", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
