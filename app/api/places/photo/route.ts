/**
 * Photo proxy. Mobile passes a place_id and we return the first photo as a
 * binary stream. Keeps the API key out of the client. Caches at the CDN edge.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PHOTO_FIELD_MASK = "photos";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get("place_id");
  const maxWidth = url.searchParams.get("max_width") ?? "640";
  if (!placeId) return NextResponse.json({ error: "place_id required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 200 });

  try {
    // 1. Look up the place's photos array.
    const detailResp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": PHOTO_FIELD_MASK },
    });
    if (!detailResp.ok) return NextResponse.json({ error: `Places ${detailResp.status}` }, { status: 200 });
    const detail = (await detailResp.json()) as { photos?: Array<{ name: string }> };
    const photoName = detail.photos?.[0]?.name;
    if (!photoName) {
      // Predictable empty PNG so <Image /> still renders something.
      return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=3600" } });
    }

    // 2. Fetch the photo media itself.
    const mediaResp = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${encodeURIComponent(maxWidth)}&key=${apiKey}`,
      { redirect: "follow" },
    );
    if (!mediaResp.ok || !mediaResp.body) {
      return new Response(null, { status: 204 });
    }
    return new Response(mediaResp.body, {
      status: 200,
      headers: {
        "Content-Type": mediaResp.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
