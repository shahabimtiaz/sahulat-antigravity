import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clat = url.searchParams.get("clat");
  const clng = url.searchParams.get("clng");
  const plat = url.searchParams.get("plat");
  const plng = url.searchParams.get("plng");

  if (!clat || !clng) {
    return NextResponse.json({ error: "clat and clng are required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 200 });
  }

  const size = "600x300";
  let mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=${size}&key=${apiKey}&scale=2`;

  if (plat && plng) {
    // Both customer and provider locations
    mapUrl += `&markers=color:blue%7Clabel:P%7C${plat},${plng}`;
    mapUrl += `&markers=color:red%7Clabel:C%7C${clat},${clng}`;
    mapUrl += `&path=color:0x0000ff|weight:4|${plat},${plng}|${clat},${clng}`;
  } else {
    // Just customer location
    mapUrl += `&markers=color:red%7C${clat},${clng}`;
    mapUrl += `&zoom=15`;
  }

  try {
    const mapResp = await fetch(mapUrl, { redirect: "follow" });
    if (!mapResp.ok || !mapResp.body) {
      return new Response(null, { status: 204 });
    }
    
    return new Response(mapResp.body, {
      status: 200,
      headers: {
        "Content-Type": mapResp.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new Response(null, { status: 204 });
  }
}
