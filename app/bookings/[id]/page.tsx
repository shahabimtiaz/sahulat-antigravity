import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/server";
import BookingClient from "./booking-client";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAdminSupabase();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*, providers:provider_id (id, name, area, city, phone, rating_avg, hourly_rate, languages, gender)")
    .eq("id", id)
    .single();

  if (error || !booking) return notFound();

  return (
    <main className="mx-auto w-full max-w-md sm:max-w-2xl px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-ink-muted hover:text-ink"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-semibold">Booking</h1>
        <Badge tone="brand" className="ml-auto">{booking.status.replace("_", " ")}</Badge>
      </header>

      <BookingClient booking={booking as unknown as Record<string, unknown>} />

      <div className="text-center text-xs text-ink-dim pt-4">
        <Link href={`/traces/${id}`} className="hover:text-ink-muted">View agent reasoning trace →</Link>
      </div>
    </main>
  );
}
