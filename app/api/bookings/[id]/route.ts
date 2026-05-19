import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, providers:provider_id (id, name, area, city, phone, rating_avg, hourly_rate, languages, on_time_score, cancel_rate, lat, lng)")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ booking: data });
}
