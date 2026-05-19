/**
 * Google Places API (New) client + Supabase mock fallback.
 *
 * Strategy:
 *  1. Try Places `searchNearby` with included primary types mapped from our service.
 *  2. Normalize results to ProviderRow shape (filling reputation fields with
 *     conservative defaults so the matcher can still rank them).
 *  3. Always merge with Supabase seed providers and dedupe by name + external_place_id.
 *  4. If Places is unconfigured or fails, fall back to Supabase-only.
 */
import { getAdminSupabase } from "@/lib/supabase/server";
import type { ProviderRow, ServiceType } from "@/lib/agents/types";
import type { TraceCollector } from "@/lib/agents/trace";

const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";

const SERVICE_TO_PLACE_TYPES: Record<ServiceType, string[]> = {
  ac_repair: ["electronics_store", "hardware_store"],
  plumbing: ["plumber"],
  electrical: ["electrician"],
  appliance_repair: ["electronics_store"],
  cleaning: ["house_cleaning_service", "laundry"],
  tutoring: ["tutor", "school"],
  beauty: ["beauty_salon", "hair_salon"],
  driver: ["taxi_stand"],
  mechanic: ["car_repair"],
  carpentry: ["furniture_store"],
  other: [],
};

type PlacesSearchInput = {
  service: ServiceType;
  lat: number;
  lng: number;
  radius_m?: number;
};

export async function discoverProviders(
  input: PlacesSearchInput,
  trace: TraceCollector,
): Promise<ProviderRow[]> {
  const t0 = Date.now();
  const dbProviders = await fetchSeedProviders(input);

  const useLive = process.env.USE_LIVE_PLACES === "true" && !!process.env.GOOGLE_MAPS_API_KEY;
  if (!useLive) {
    trace.push({
      agent: "discovery",
      step: "seed_only",
      input_summary: `service=${input.service} (${input.lat.toFixed(3)},${input.lng.toFixed(3)})`,
      output: { sources: ["supabase"], count: dbProviders.length },
      rationale: "USE_LIVE_PLACES is off or no API key — using Supabase seed only.",
      latency_ms: Date.now() - t0,
    });
    return dbProviders;
  }

  // Live Places call
  try {
    const types = SERVICE_TO_PLACE_TYPES[input.service];
    if (!types.length) throw new Error(`No Places type mapping for ${input.service}`);

    const body = {
      includedPrimaryTypes: types,
      maxResultCount: 15,
      locationRestriction: {
        circle: { center: { latitude: input.lat, longitude: input.lng }, radius: input.radius_m ?? 7000 },
      },
      rankPreference: "DISTANCE",
    };

    const resp = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.formattedAddress,places.primaryType",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Places ${resp.status}: ${await resp.text().then((t) => t.slice(0, 200))}`);
    }
    const json = (await resp.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        location?: { latitude: number; longitude: number };
        rating?: number;
        userRatingCount?: number;
        formattedAddress?: string;
        primaryType?: string;
      }>;
    };

    const liveRaw: ProviderRow[] = (json.places ?? []).map((p) => normalizePlace(p, input.service));
    const live = await upsertLiveProviders(liveRaw);
    const merged = mergeUnique([...live, ...dbProviders]);
    trace.push({
      agent: "discovery",
      step: "places+seed",
      input_summary: `types=${types.join(",")} radius=${input.radius_m ?? 7000}m`,
      output: { live_count: liveRaw.length, live_bookable_count: live.length, seed_count: dbProviders.length, merged: merged.length },
      rationale: `Fetched ${liveRaw.length} live providers from Places; persisted ${live.length} for booking; merged with ${dbProviders.length} seed providers.`,
      latency_ms: Date.now() - t0,
    });
    return merged;
  } catch (err) {
    trace.push({
      agent: "discovery",
      step: "places_failed_fallback",
      input_summary: `service=${input.service}`,
      output: { error: (err as Error).message, seed_count: dbProviders.length },
      rationale: `Places call failed: ${(err as Error).message}. Falling back to Supabase seed.`,
      latency_ms: Date.now() - t0,
    });
    return dbProviders;
  }
}

async function upsertLiveProviders(rows: ProviderRow[]): Promise<ProviderRow[]> {
  if (!rows.length) return [];
  try {
    const supabase = getAdminSupabase();
    const payload = rows
      .filter((row) => row.external_place_id)
      .map((row) => ({
        external_place_id: row.external_place_id,
        name: row.name,
        primary_service: row.primary_service,
        skills: row.skills,
        specialization_level: row.specialization_level,
        certifications: row.certifications,
        city: row.city,
        area: row.area,
        lat: row.lat,
        lng: row.lng,
        rating_avg: row.rating_avg,
        rating_count: row.rating_count,
        recent_negative_review_count: row.recent_negative_review_count,
        on_time_score: row.on_time_score,
        cancel_rate: row.cancel_rate,
        hourly_rate: row.hourly_rate,
        visit_fee: row.visit_fee,
        daily_capacity: row.daily_capacity,
        jobs_today: row.jobs_today,
        blacklisted: row.blacklisted,
        risk_score: row.risk_score,
        gender: row.gender,
        languages: row.languages,
        bio: row.bio,
        specialization_tags: row.specialization_tags ?? [],
      }));

    const { data, error } = await supabase
      .from("providers")
      .upsert(payload, { onConflict: "external_place_id" })
      .select("*");
    if (error) {
      console.warn("upsertLiveProviders failed:", error.message);
      return [];
    }
    return ((data ?? []) as unknown[]).map(coerceProviderRow);
  } catch (e) {
    console.warn("upsertLiveProviders failed:", (e as Error).message);
    return [];
  }
}

async function fetchSeedProviders(input: PlacesSearchInput): Promise<ProviderRow[]> {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.rpc("nearby_providers", {
      p_service: input.service,
      p_lat: input.lat,
      p_lng: input.lng,
      p_radius_km: (input.radius_m ?? 15_000) / 1000,
      p_limit: 25,
    });
    if (error) {
      console.warn("nearby_providers rpc error:", error.message);
      return [];
    }
    return ((data ?? []) as unknown[]).map(coerceProviderRow);
  } catch (e) {
    console.warn("fetchSeedProviders failed:", (e as Error).message);
    return [];
  }
}

function normalizePlace(p: NonNullable<NonNullable<Awaited<ReturnType<typeof fetchPlaceShape>>>>[number], service: ServiceType): ProviderRow {
  const rating = p.rating ?? 4.2;
  const count = p.userRatingCount ?? 8;
  return {
    id: `live_${p.id}`,
    external_place_id: p.id,
    name: p.displayName?.text ?? "Unknown Provider",
    primary_service: service,
    skills: [],
    specialization_level: "intermediate",
    certifications: [],
    city: p.formattedAddress?.split(",").slice(-2, -1)[0]?.trim() ?? "Unknown",
    area: p.formattedAddress?.split(",")[0] ?? null,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    rating_avg: rating,
    rating_count: count,
    recent_negative_review_count: 0,
    on_time_score: 0.82,        // unknown — set near-mean
    cancel_rate: 0.06,
    hourly_rate: 900,
    visit_fee: 300,
    daily_capacity: 6,
    jobs_today: 0,
    blacklisted: false,
    risk_score: 0.1,
    gender: null,
    languages: ["ur-Latn"],
    bio: p.formattedAddress ?? null,
  };
}

function mergeUnique(rows: ProviderRow[]): ProviderRow[] {
  const seenKeys = new Set<string>();
  const out: ProviderRow[] = [];
  for (const r of rows) {
    const key = (r.external_place_id ?? "") + "|" + r.name.toLowerCase();
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(r);
  }
  return out;
}

// Helper purely for typing of normalizePlace.
async function fetchPlaceShape(): Promise<Array<{
  id: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
}> | undefined> { return undefined; }

function coerceProviderRow(x: unknown): ProviderRow {
  const r = x as Record<string, unknown>;
  return {
    id: String(r.id),
    name: String(r.name),
    primary_service: String(r.primary_service) as ProviderRow["primary_service"],
    skills: (r.skills as string[]) ?? [],
    specialization_level: (r.specialization_level as ProviderRow["specialization_level"]) ?? "intermediate",
    certifications: (r.certifications as string[]) ?? [],
    city: String(r.city),
    area: (r.area as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    rating_avg: Number(r.rating_avg ?? 4.4),
    rating_count: Number(r.rating_count ?? 0),
    recent_negative_review_count: Number(r.recent_negative_review_count ?? 0),
    on_time_score: Number(r.on_time_score ?? 0.85),
    cancel_rate: Number(r.cancel_rate ?? 0.05),
    hourly_rate: Number(r.hourly_rate ?? 800),
    visit_fee: Number(r.visit_fee ?? 300),
    daily_capacity: Number(r.daily_capacity ?? 6),
    jobs_today: Number(r.jobs_today ?? 0),
    blacklisted: Boolean(r.blacklisted ?? false),
    risk_score: Number(r.risk_score ?? 0.05),
    gender: (r.gender as string | null) ?? null,
    languages: (r.languages as string[]) ?? ["ur-Latn", "en"],
    bio: (r.bio as string | null) ?? null,
    external_place_id: r.external_place_id as string | undefined,
    specialization_tags: (r.specialization_tags as string[]) ?? [],
  };
}
