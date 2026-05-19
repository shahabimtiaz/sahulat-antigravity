/**
 * Resolve a placeId to { lat, lng, address, name, rating }. Used after
 * the user picks an autocomplete prediction.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get("place_id");
  if (!placeId) return NextResponse.json({ error: "place_id required" }, { status: 400 });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 200 });

  try {
    const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,userRatingCount,types",
      },
    });
    if (!resp.ok) return NextResponse.json({ error: `Places ${resp.status}` }, { status: 200 });
    const json = (await resp.json()) as {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      rating?: number;
      userRatingCount?: number;
    };
    return NextResponse.json({
      place_id: json.id,
      name: json.displayName?.text ?? null,
      address: json.formattedAddress ?? null,
      lat: json.location?.latitude ?? null,
      lng: json.location?.longitude ?? null,
      rating: json.rating ?? null,
      rating_count: json.userRatingCount ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
