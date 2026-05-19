/**
 * Issue a signed upload URL for a proof photo.
 *
 * The mobile (or web) client POSTs { booking_id, content_type } and
 * receives { upload_url, path, public_url }. Client then PUTs the raw
 * bytes to upload_url with the Content-Type header. After upload, the
 * caller PATCHes the booking via /api/bookings/[id]/status with
 * proof_photo_urls including public_url.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/server";

const Body = z.object({
  booking_id: z.string().uuid(),
  content_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]).default("image/jpeg"),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try { parsed = Body.parse(await req.json()); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const supabase = getAdminSupabase();
  const ext = parsed.content_type.split("/")[1].replace("jpeg", "jpg");
  const path = `${parsed.booking_id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("proofs")
    .createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pub } = supabase.storage.from("proofs").getPublicUrl(path);

  return NextResponse.json({
    upload_url: data.signedUrl,
    token: data.token,
    path,
    public_url: pub.publicUrl,
    content_type: parsed.content_type,
  });
}
