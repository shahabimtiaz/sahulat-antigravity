import Constants from "expo-constants";

function cleanBase(base?: string | null): string | null {
  const trimmed = base?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function inferApiBaseFromExpoHost(): string | null {
  const c = Constants as unknown as {
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };
  const hostUri =
    Constants.expoConfig?.hostUri ??
    c.manifest2?.extra?.expoClient?.hostUri ??
    c.manifest?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return `http://${host}:3000`;
}

function inferApiBaseFromBrowserHost(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://${hostname}:3000`;
  }
  return null;
}

function browserApiBaseOverride(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const storageKey = "sahulatApiBase";
  const fromQuery = cleanBase(new URLSearchParams(window.location.search).get("apiBase"));
  if (fromQuery) {
    window.localStorage?.setItem(storageKey, fromQuery);
    return fromQuery;
  }
  return cleanBase(window.localStorage?.getItem(storageKey));
}

const CONFIG_API_BASE = cleanBase(
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE,
) ?? inferApiBaseFromExpoHost() ?? inferApiBaseFromBrowserHost() ?? "http://localhost:3000";

function resolveApiBase() {
  return browserApiBaseOverride() ?? CONFIG_API_BASE;
}

async function send<T>(path: string, init?: RequestInit, expectedErrorStatuses: number[] = []): Promise<T> {
  let r: Response;
  const apiBase = resolveApiBase();
  try {
    r = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new Error(
      `Could not reach Sahulat API at ${apiBase}. Set EXPO_PUBLIC_API_BASE or open mobile web with ?apiBase=http://HOST:PORT. ${(e as Error).message}`,
    );
  }
  const text = await r.text();
  const contentType = r.headers.get("content-type") ?? "";
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {
      error: contentType.includes("text/html")
        ? `Sahulat API at ${apiBase} returned an HTML page instead of JSON. Check the API base URL and backend port.`
        : text.slice(0, 200),
    };
  }
  if (!r.ok && !expectedErrorStatuses.includes(r.status)) {
    throw new Error((json as { error?: string }).error ?? `HTTP ${r.status}`);
  }
  return json as T;
}

export const api = {
  orchestrate: (message: string, location?: { lat: number; lng: number }) =>
    send<OrchestrateResult>("/api/orchestrate", {
      method: "POST",
      body: JSON.stringify({ message, location }),
    }),
  confirm: (body: ConfirmBody) =>
    send<{ status: "confirmed" | "conflict"; booking_id?: string; overlapping_booking_id?: string }>("/api/confirm", { method: "POST", body: JSON.stringify(body) }, [409]),
  getBooking: (id: string) => send<{ booking: Record<string, unknown> }>(`/api/bookings/${id}`),
  setStatus: (id: string, status: string, extra: Record<string, unknown> = {}) =>
    send(`/api/bookings/${id}/status`, { method: "POST", body: JSON.stringify({ status, ...extra }) }),
  review: (id: string, rating: number, comment: string) =>
    send(`/api/bookings/${id}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) }),
  dispute: (body: DisputeBody) =>
    send("/api/disputes", { method: "POST", body: JSON.stringify(body) }),
  reschedule: (booking_id: string) =>
    send("/api/reschedule", { method: "POST", body: JSON.stringify({ booking_id }) }),
  getTraces: (bookingId: string) =>
    send<{ traces: Trace[] }>(`/api/traces/${bookingId}`),
  agents: () => send<AgentsManagerPayload>("/api/agents"),
  providerOptimize: (city: string) =>
    send<{ recommendations: ProviderRec[]; demand_forecast: DemandForecast[] }>(`/api/providers/optimize?city=${encodeURIComponent(city)}`),
  payment: (booking_id: string, method: "card" | "jazzcash" | "easypaisa" | "cod" = "card", force_outcome: "auto" | "fail" | "succeed" = "auto") =>
    send<PaymentResult>("/api/payment/confirm", { method: "POST", body: JSON.stringify({ booking_id, method, force_outcome }) }, [402]),
  uploadProofTicket: (booking_id: string, content_type: "image/jpeg" | "image/png" | "image/webp") =>
    send<UploadTicket>("/api/uploads/proof", { method: "POST", body: JSON.stringify({ booking_id, content_type }) }),
  placesAutocomplete: (q: string, biasLat?: number, biasLng?: number) => {
    const params = new URLSearchParams({ q });
    if (biasLat && biasLng) { params.set("lat", String(biasLat)); params.set("lng", String(biasLng)); }
    return send<{ predictions: PlacePrediction[] }>(`/api/places/autocomplete?${params.toString()}`);
  },
  placesDetails: (placeId: string) =>
    send<PlaceDetails>(`/api/places/details?place_id=${encodeURIComponent(placeId)}`),
};

export type PlacePrediction = {
  place_id: string;
  full_text: string;
  main_text: string;
  secondary_text: string;
};

export type PlaceDetails = {
  place_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  rating_count: number | null;
};

/** Build a public-URL string for the photo proxy. */
export function placesPhotoUrl(placeId: string, maxWidth = 640): string {
  return `${resolveApiBase()}/api/places/photo?place_id=${encodeURIComponent(placeId)}&max_width=${maxWidth}`;
}

/** Build a public-URL string for a static map showing customer and provider locations. */
export function staticMapUrl(clat: number, clng: number, plat?: number, plng?: number): string {
  let url = `${resolveApiBase()}/api/map?clat=${clat}&clng=${clng}`;
  if (plat && plng) url += `&plat=${plat}&plng=${plng}`;
  return url;
}

export type UploadTicket = {
  upload_url: string;
  token: string;
  path: string;
  public_url: string;
  content_type: string;
};

/** Upload raw bytes to a signed Supabase upload URL. */
export async function uploadProofPhoto(ticket: UploadTicket, bodyBytes: Blob | ArrayBuffer | Uint8Array): Promise<void> {
  const r = await fetch(ticket.upload_url, {
    method: "PUT",
    headers: { "Content-Type": ticket.content_type, "x-upsert": "true" },
    body: bodyBytes as BodyInit,
  });
  if (!r.ok) throw new Error(`upload failed: HTTP ${r.status}`);
}

export type AgentsManagerPayload = {
  skills: Array<{ name: string; description: string; body_length: number; path: string }>;
  workflows: Array<{ name: string; description: string; body_length: number; path: string }>;
  agents: Array<{ agent: string; runs_24h: number; avg_latency_ms: number; latest_at: string | null; last_rationale: string | null }>;
  recent_traces: Trace[];
  artifacts: {
    bookings: Array<{ id: string; request_text: string; service: string; status: string; total_price: number; created_at: string }>;
    disputes: Array<{ id: string; booking_id: string; case_type: string; decision: string; refund_amount: number; status: string; created_at: string }>;
  };
};

export type ProviderRec = {
  provider_id: string; name: string; utilization: number;
  suggested_slots: string[]; reason: string;
};

export type DemandForecast = {
  service: string; area: string; hour: number; expected_jobs: number;
};

export type PaymentResult =
  | { status: "authorized"; attempts: number; method: string }
  | { status: "failed"; reason: string; attempts: number; retry_allowed: boolean; alternatives: string[] };

export type Trace = {
  id: string; agent: string; step: string; rationale: string | null;
  latency_ms: number | null; model: string | null; confidence: number | null;
  input_summary: string | null; output: unknown; created_at: string;
};

export type OrchestrateResult = {
  status: "needs_clarification" | "offer" | "waitlisted" | "no_providers";
  request_id: string;
  intent: Record<string, any>;
  questions?: string[];
  ranking?: RankedProvider[];
  top_quote?: PriceQuote;
  alt_quote?: PriceQuote;
  quotes?: Record<string, PriceQuote>;
  schedule?: ScheduleResult;
  rationale?: string;
  trace: Trace[];
};

export type RankedProvider = {
  provider_id: string; name: string; city: string; area: string | null;
  distance_km: number; score: number; why: string; flags: string[];
  provider: {
    rating_avg: number;
    rating_count: number;
    on_time_score: number;
    specialization_level: string;
    external_place_id?: string | null;
    bio?: string | null;
    languages?: string[];
    gender?: string | null;
  };
  breakdown: Record<string, { raw: number; weighted: number }>;
};

export type PriceQuote = {
  currency: string; line_items: Array<{ label: string; amount: number; kind: string; note?: string }>;
  subtotal: number; total: number;
  budget_friendly_alternative?: { total: number; swap: string };
  fairness: { user_view: string; provider_view: string };
  rationale: string;
};

export type ScheduleResult = {
  status: "confirmed" | "alternates_offered" | "waitlisted" | "no_capacity";
  slot?: { start: string; end: string; provider_id: string };
  alternates?: Array<{ start: string; end: string; provider_id: string; why: string }>;
  rationale: string;
};

export type ConfirmBody = {
  request_id: string; intent: Record<string, unknown>; provider_id: string;
  slot_start: string; slot_end: string; price_breakdown: PriceQuote; request_text: string;
};

export type DisputeBody = {
  booking_id: string; raised_by: "user" | "provider";
  case_type: "no_show" | "late_arrival" | "quality" | "price" | "overrun" | "cancellation_post_confirm";
  description?: string; evidence_urls?: string[];
};

export const API_BASE = CONFIG_API_BASE;
