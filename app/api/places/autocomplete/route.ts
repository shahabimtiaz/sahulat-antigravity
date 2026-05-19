/**
 * Google Places Autocomplete proxy.
 *
 * Keeps the API key server-side. Mobile and web clients call this endpoint
 * with `?q=...&lat=...&lng=...` and receive normalized predictions.
 */
import { NextResponse } from "next/server";

const URL_AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if (!q) return NextResponse.json({ predictions: [] });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ predictions: [], error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 200 });
  }

  const body: Record<string, unknown> = {
    input: q,
    // Bias toward Pakistan for our demo scope; can be lifted with ?cc= override.
    regionCode: url.searchParams.get("cc")?.toLowerCase() ?? "pk",
    includedPrimaryTypes: ["geocode", "establishment"],
  };
  if (lat && lng) {
    body.locationBias = {
      circle: {
        center: { latitude: Number(lat), longitude: Number(lng) },
        radius: 50_000,
      },
    };
  }

  try {
    const resp = await fetch(URL_AUTOCOMPLETE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return NextResponse.json({ predictions: [], error: `Places ${resp.status}` }, { status: 200 });
    }
    const json = (await resp.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };

    const predictions = (json.suggestions ?? [])
      .filter((s) => s.placePrediction?.placeId)
      .map((s) => ({
        place_id: s.placePrediction!.placeId,
        full_text: s.placePrediction!.text?.text ?? "",
        main_text: s.placePrediction!.structuredFormat?.mainText?.text ?? s.placePrediction!.text?.text ?? "",
        secondary_text: s.placePrediction!.structuredFormat?.secondaryText?.text ?? "",
      }));

    return NextResponse.json({ predictions });
  } catch (e) {
    return NextResponse.json({ predictions: [], error: (e as Error).message }, { status: 200 });
  }
}
