import { z } from "zod";

// =========================================================================
// Shared agent types & zod schemas
// =========================================================================

export const ServiceTypeEnum = z.enum([
  "ac_repair","plumbing","electrical","appliance_repair","cleaning",
  "tutoring","beauty","driver","mechanic","carpentry","other",
]);
export type ServiceType = z.infer<typeof ServiceTypeEnum>;

export const ComplexityEnum = z.enum(["basic","intermediate","complex"]);
export type Complexity = z.infer<typeof ComplexityEnum>;

export const UrgencyEnum = z.enum(["low","medium","high","emergency"]);
export type Urgency = z.infer<typeof UrgencyEnum>;

export const IntentSchema = z.object({
  service_type: ServiceTypeEnum,
  service_label: z.string(),
  issue_severity: z.enum(["low","medium","high"]),
  location: z.object({
    raw: z.string(),
    city: z.string().optional(),
    area: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  time: z.object({
    kind: z.enum(["asap","today","tomorrow_morning","tomorrow_afternoon","tomorrow_evening","specific"]),
    iso: z.string().optional(),
    raw: z.string(),
  }),
  urgency: UrgencyEnum,
  price_sensitivity: z.enum(["low","medium","high"]),
  constraints: z.array(z.string()).default([]),
  complexity_hint: ComplexityEnum,
  detected_languages: z.array(z.enum(["ur","ur-Latn","en"])).default([]),
  confidence: z.number().min(0).max(1),
  clarifying_questions: z.array(z.string()).default([]),
  rationale: z.string(),
});
export type Intent = z.infer<typeof IntentSchema>;

export const FactorNames = [
  "travel_time", "availability", "rating", "review_recency", "on_time_reliability",
  "skill_specialization", "price_fit", "capacity", "cancellation", "user_preference", "risk",
] as const;
export type FactorName = typeof FactorNames[number];

export const FACTOR_WEIGHTS: Record<FactorName, number> = {
  travel_time: 0.18,
  availability: 0.16,
  rating: 0.12,
  review_recency: 0.06,
  on_time_reliability: 0.10,
  skill_specialization: 0.12,
  price_fit: 0.08,
  capacity: 0.05,
  cancellation: 0.06,
  user_preference: 0.04,
  risk: 0.03,
};

export type RankedProvider = {
  provider_id: string;
  name: string;
  city: string;
  area: string | null;
  lat: number;
  lng: number;
  distance_km: number;
  score: number; // 0..100
  breakdown: Record<FactorName, { raw: number; weighted: number }>;
  why: string;
  flags: string[];
  provider: ProviderRow;
};

export type ProviderRow = {
  id: string;
  name: string;
  primary_service: string;
  skills: string[];
  specialization_level: Complexity;
  /** Auto-grown from positive review sentiment themes; boosts specialization factor. */
  specialization_tags?: string[];
  certifications: string[];
  city: string;
  area: string | null;
  lat: number;
  lng: number;
  rating_avg: number;
  rating_count: number;
  recent_negative_review_count: number;
  on_time_score: number;
  cancel_rate: number;
  hourly_rate: number;
  visit_fee: number;
  daily_capacity: number;
  jobs_today: number;
  blacklisted: boolean;
  risk_score: number;
  gender: string | null;
  languages: string[];
  bio: string | null;
  // optional live-source extras
  external_place_id?: string;
};

export type PriceQuote = {
  currency: "PKR";
  line_items: Array<{
    label: string;
    amount: number;
    kind: "fee" | "adjustment" | "discount" | "surge";
    note?: string;
  }>;
  subtotal: number;
  total: number;
  budget_friendly_alternative?: { total: number; swap: string };
  fairness: { user_view: string; provider_view: string };
  rationale: string;
};

export type ScheduleResult =
  | {
      status: "confirmed";
      slot: { start: string; end: string; provider_id: string };
      conflicts_considered: Array<{ booking_id: string; reason: string }>;
      rationale: string;
    }
  | {
      status: "alternates_offered" | "waitlisted" | "no_capacity";
      slot?: undefined;
      alternates?: Array<{ start: string; end: string; provider_id: string; why: string }>;
      conflicts_considered: Array<{ booking_id: string; reason: string }>;
      rationale: string;
    };
