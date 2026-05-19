/**
 * Seed script. Run with:
 *   GEMINI_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed
 *
 * Inserts seedProviders + provider_availability (Mon-Sat 9am-9pm by default).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { seedProviders } from "../data/seed-providers";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Seeding ${seedProviders.length} providers…`);
  for (const p of seedProviders) {
    const providerData = {
      name: p.name,
      primary_service: p.primary_service,
      skills: p.skills,
      specialization_level: p.specialization_level,
      certifications: p.certifications,
      city: p.city,
      area: p.area,
      lat: p.lat,
      lng: p.lng,
      rating_avg: p.rating_avg,
      rating_count: p.rating_count,
      recent_negative_review_count: p.recent_negative_review_count,
      on_time_score: p.on_time_score,
      cancel_rate: p.cancel_rate,
      hourly_rate: p.hourly_rate,
      visit_fee: p.visit_fee,
      daily_capacity: p.daily_capacity,
      gender: p.gender ?? null,
      languages: p.languages,
      bio: p.bio,
    };

    const { data: existing } = await supabase.from("providers").select("id").eq("name", p.name).maybeSingle();
    let data, error;

    if (existing) {
      ({ data, error } = await supabase.from("providers").update(providerData).eq("id", existing.id).select("id").single());
    } else {
      ({ data, error } = await supabase.from("providers").insert(providerData).select("id").single());
    }
    if (error) {
      console.error("  fail:", p.name, error.message);
      continue;
    }
    if (!data) {
      console.error("  fail:", p.name, "provider upsert returned no id");
      continue;
    }
    // Default availability: Mon-Sat (1..6), 9:00-21:00 (540..1260)
    const rows = [1, 2, 3, 4, 5, 6].map((day) => ({
      provider_id: data.id,
      day_of_week: day,
      start_minute: 540,
      end_minute: 1260,
    }));
    await supabase.from("provider_availability").upsert(rows, {
      onConflict: "provider_id,day_of_week,start_minute",
    });
    console.log("  ok:", p.name);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
