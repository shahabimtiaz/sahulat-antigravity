import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export async function GET(_req: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("traces")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ traces: data ?? [] });
}
