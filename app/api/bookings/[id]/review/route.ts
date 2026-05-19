import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/gemini/client";
import { TraceCollector, newRequestId } from "@/lib/agents/trace";

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(""),
});

const SENTIMENT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    themes: { type: "array", items: { type: "string" } },
  },
  required: ["score", "themes"],
} as const;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getAdminSupabase();
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, provider_id, profile_id")
    .eq("id", id).single();
  if (error || !booking) return NextResponse.json({ error: "booking not found" }, { status: 404 });

  // Sentiment via Gemini fast — fallback to neutral if it fails.
  let sentiment = { score: 0, themes: [] as string[] };
  try {
    if (parsed.comment.trim()) {
      const { data } = await generateJSON<typeof sentiment>({
        system:
          "Classify customer review sentiment in -1..1 (negative→positive). Extract 1-4 short themes (e.g. 'punctual', 'overcharged', 'explained_well', 'left_mess'). Return JSON only.",
        user: parsed.comment,
        model: "fast",
        schema: SENTIMENT_SCHEMA as never,
        temperature: 0.1,
      });
      sentiment = data;
    }
  } catch (e) {
    console.warn("sentiment failed", (e as Error).message);
  }

  // Insert review.
  await supabase.from("reviews").insert({
    booking_id: id,
    provider_id: booking.provider_id,
    profile_id: booking.profile_id,
    rating: parsed.rating,
    comment: parsed.comment,
    sentiment_score: sentiment.score,
    themes: sentiment.themes,
  });

  // Patch booking.
  await supabase.from("bookings").update({
    rating: parsed.rating,
    rating_comment: parsed.comment,
    sentiment_score: sentiment.score,
    sentiment_themes: sentiment.themes,
  }).eq("id", id);

  // Provider reputation update (EWMA) + sentiment-driven specialization tags.
  if (booking.provider_id) {
    const { data: p } = await supabase.from("providers")
      .select("rating_avg, rating_count, recent_negative_review_count, specialization_tags")
      .eq("id", booking.provider_id).single();
    if (p) {
      const newCount = p.rating_count + 1;
      const newAvg = (p.rating_avg * p.rating_count + parsed.rating) / newCount;
      const negDelta = (parsed.rating <= 2 || sentiment.score < -0.3) ? 1 : 0;

      // Positive sentiment + 4+ rating: themes become specialization_tags.
      // Negative sentiment: themes are NOT added (we don't want "rushed" as a tag).
      const existing = new Set((p.specialization_tags as string[] | null) ?? []);
      if (parsed.rating >= 4 && sentiment.score >= 0.2) {
        for (const theme of sentiment.themes) {
          // Normalize and filter to short, evidently-positive tags
          const t = theme.toLowerCase().replace(/\s+/g, "_").slice(0, 32);
          if (t && !/(over|left_|rushed|late|miss|bad|poor|dirty)/i.test(t)) existing.add(t);
        }
      }

      await supabase.from("providers").update({
        rating_avg: Math.round(newAvg * 100) / 100,
        rating_count: newCount,
        recent_negative_review_count: p.recent_negative_review_count + negDelta,
        specialization_tags: Array.from(existing).slice(0, 24),
      }).eq("id", booking.provider_id);
    }
  }

  const trace = new TraceCollector(newRequestId());
  trace.attachBookingId(id);
  trace.push({
    agent: "quality",
    step: "review_submitted",
    output: { rating: parsed.rating, sentiment },
    rationale: `Review captured; reputation EWMA updated. ${sentiment.score < -0.3 ? "Negative review flagged for future matching." : ""}`,
  });
  await trace.flush();

  return NextResponse.json({ ok: true, sentiment });
}
