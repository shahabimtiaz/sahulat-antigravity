// Seed data: 32 realistic providers across Islamabad / Rawalpindi / Lahore
// with varied skills, ratings, on-time, cancellation rates, and certifications.
//
// Coordinates are sector/area approximations within each city.

export type SeedProvider = {
  name: string;
  primary_service:
    | "ac_repair"
    | "plumbing"
    | "electrical"
    | "appliance_repair"
    | "cleaning"
    | "tutoring"
    | "beauty"
    | "driver"
    | "mechanic"
    | "carpentry";
  skills: string[];
  specialization_level: "basic" | "intermediate" | "complex";
  certifications: string[];
  city: "Islamabad" | "Rawalpindi" | "Lahore";
  area: string;
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
  gender?: "male" | "female";
  languages: string[];
  bio: string;
};

export const seedProviders: SeedProvider[] = [
  // ===== Islamabad — AC repair =====
  {
    name: "Cool Breeze AC Services",
    primary_service: "ac_repair",
    skills: ["split_ac_service", "split_ac_install", "gas_refill", "inverter_diagnosis"],
    specialization_level: "complex",
    certifications: ["split_ac_certified"],
    city: "Islamabad", area: "G-13", lat: 33.6480, lng: 72.9728,
    rating_avg: 4.7, rating_count: 184, recent_negative_review_count: 1,
    on_time_score: 0.94, cancel_rate: 0.03,
    hourly_rate: 1200, visit_fee: 400, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "10+ years split + inverter AC specialist. Original parts only.",
  },
  {
    name: "QuickFix AC (Ali Raza)",
    primary_service: "ac_repair",
    skills: ["window_ac_service", "split_ac_service", "general_diagnosis"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Islamabad", area: "G-13", lat: 33.6515, lng: 72.9799,
    rating_avg: 4.5, rating_count: 96, recent_negative_review_count: 0,
    on_time_score: 0.81, cancel_rate: 0.08,
    hourly_rate: 900, visit_fee: 300, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn"],
    bio: "Same-day visits in Islamabad. Honest pricing.",
  },
  {
    name: "FrostMaster Technicians",
    primary_service: "ac_repair",
    skills: ["inverter_diagnosis", "compressor_replace", "pcb_repair"],
    specialization_level: "complex",
    certifications: ["pec_certified", "split_ac_certified"],
    city: "Islamabad", area: "F-10", lat: 33.7012, lng: 73.0240,
    rating_avg: 4.8, rating_count: 312, recent_negative_review_count: 0,
    on_time_score: 0.96, cancel_rate: 0.02,
    hourly_rate: 1500, visit_fee: 500, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Complex inverter and PCB level repairs. Lab-grade tools.",
  },
  {
    name: "BudgetCool Repairs",
    primary_service: "ac_repair",
    skills: ["window_ac_service", "general_diagnosis"],
    specialization_level: "basic",
    certifications: [],
    city: "Islamabad", area: "G-11", lat: 33.6695, lng: 72.9933,
    rating_avg: 4.2, rating_count: 58, recent_negative_review_count: 3,
    on_time_score: 0.74, cancel_rate: 0.14,
    hourly_rate: 700, visit_fee: 250, daily_capacity: 7,
    gender: "male", languages: ["ur-Latn"],
    bio: "Pocket-friendly AC service.",
  },

  // ===== Islamabad — plumbing =====
  {
    name: "Plumbing Pro Faisal",
    primary_service: "plumbing",
    skills: ["leak_repair", "tap_install", "drain_clearance", "geyser_install"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Islamabad", area: "G-9", lat: 33.6961, lng: 73.0287,
    rating_avg: 4.6, rating_count: 142, recent_negative_review_count: 0,
    on_time_score: 0.92, cancel_rate: 0.04,
    hourly_rate: 800, visit_fee: 250, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Plumbing emergencies handled same day.",
  },
  {
    name: "DrainKing Islamabad",
    primary_service: "plumbing",
    skills: ["drain_clearance", "sewer_jetting", "pipe_replace"],
    specialization_level: "complex",
    certifications: ["sewer_specialist"],
    city: "Islamabad", area: "I-8", lat: 33.6720, lng: 73.0744,
    rating_avg: 4.5, rating_count: 89, recent_negative_review_count: 1,
    on_time_score: 0.88, cancel_rate: 0.05,
    hourly_rate: 1100, visit_fee: 400, daily_capacity: 4,
    gender: "male", languages: ["ur-Latn"],
    bio: "Heavy-duty drain unclogging. Jetting equipment available.",
  },
  {
    name: "QuickTap Plumbers",
    primary_service: "plumbing",
    skills: ["tap_install", "minor_leak"],
    specialization_level: "basic",
    certifications: [],
    city: "Islamabad", area: "F-11", lat: 33.6810, lng: 72.9908,
    rating_avg: 4.1, rating_count: 47, recent_negative_review_count: 2,
    on_time_score: 0.79, cancel_rate: 0.12,
    hourly_rate: 600, visit_fee: 200, daily_capacity: 8,
    gender: "male", languages: ["ur-Latn"],
    bio: "Quick tap and washer replacements.",
  },

  // ===== Islamabad — electrical =====
  {
    name: "Volt Masters",
    primary_service: "electrical",
    skills: ["wiring", "switch_replace", "breaker_install", "ups_setup", "solar_inverter"],
    specialization_level: "complex",
    certifications: ["pec_certified"],
    city: "Islamabad", area: "G-13", lat: 33.6452, lng: 72.9810,
    rating_avg: 4.7, rating_count: 167, recent_negative_review_count: 0,
    on_time_score: 0.93, cancel_rate: 0.03,
    hourly_rate: 1300, visit_fee: 350, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "PEC-certified electrician. Full home rewiring done.",
  },
  {
    name: "Sparky On-Call",
    primary_service: "electrical",
    skills: ["switch_replace", "fan_install", "wiring"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Islamabad", area: "G-10", lat: 33.6743, lng: 73.0143,
    rating_avg: 4.4, rating_count: 74, recent_negative_review_count: 1,
    on_time_score: 0.86, cancel_rate: 0.06,
    hourly_rate: 850, visit_fee: 250, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn"],
    bio: "Same-day electrician across Islamabad.",
  },

  // ===== Islamabad — cleaning =====
  {
    name: "SparkleHome Cleaning",
    primary_service: "cleaning",
    skills: ["deep_clean", "kitchen_clean", "bathroom_clean", "sofa_shampoo"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Islamabad", area: "F-8", lat: 33.7185, lng: 73.0540,
    rating_avg: 4.6, rating_count: 211, recent_negative_review_count: 0,
    on_time_score: 0.91, cancel_rate: 0.04,
    hourly_rate: 650, visit_fee: 0, daily_capacity: 5,
    gender: "female", languages: ["ur-Latn", "en"],
    bio: "All-female cleaning team. Eco-friendly products.",
  },
  {
    name: "Daily Help Cleaners",
    primary_service: "cleaning",
    skills: ["deep_clean", "general_clean"],
    specialization_level: "basic",
    certifications: [],
    city: "Islamabad", area: "I-9", lat: 33.6664, lng: 73.0825,
    rating_avg: 4.2, rating_count: 63, recent_negative_review_count: 1,
    on_time_score: 0.83, cancel_rate: 0.08,
    hourly_rate: 500, visit_fee: 0, daily_capacity: 7,
    languages: ["ur-Latn"],
    bio: "Affordable home cleaning.",
  },

  // ===== Islamabad — beauty =====
  {
    name: "GlowAtHome Beauty",
    primary_service: "beauty",
    skills: ["facial", "haircut", "manicure_pedicure", "bridal"],
    specialization_level: "complex",
    certifications: ["salon_certified"],
    city: "Islamabad", area: "F-7", lat: 33.7257, lng: 73.0566,
    rating_avg: 4.8, rating_count: 254, recent_negative_review_count: 0,
    on_time_score: 0.95, cancel_rate: 0.02,
    hourly_rate: 2000, visit_fee: 0, daily_capacity: 4,
    gender: "female", languages: ["ur-Latn", "en"],
    bio: "Premium at-home salon. Bridal packages.",
  },

  // ===== Islamabad — tutoring =====
  {
    name: "MathPro — Ayesha Khan",
    primary_service: "tutoring",
    skills: ["math_olevel", "math_alevel", "physics_olevel"],
    specialization_level: "complex",
    certifications: ["cambridge_trained"],
    city: "Islamabad", area: "F-10", lat: 33.7019, lng: 73.0220,
    rating_avg: 4.9, rating_count: 88, recent_negative_review_count: 0,
    on_time_score: 0.97, cancel_rate: 0.01,
    hourly_rate: 2500, visit_fee: 0, daily_capacity: 4,
    gender: "female", languages: ["en", "ur-Latn"],
    bio: "Cambridge-trained O/A level tutor.",
  },

  // ===== Islamabad — driver =====
  {
    name: "SafeRide Bilal",
    primary_service: "driver",
    skills: ["intercity", "airport_pickup", "manual_transmission"],
    specialization_level: "intermediate",
    certifications: ["lto_license"],
    city: "Islamabad", area: "Blue Area", lat: 33.7099, lng: 73.0594,
    rating_avg: 4.5, rating_count: 121, recent_negative_review_count: 0,
    on_time_score: 0.89, cancel_rate: 0.05,
    hourly_rate: 600, visit_fee: 0, daily_capacity: 8,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Personal driver. Intercity and airport runs.",
  },

  // ===== Islamabad — mechanic =====
  {
    name: "Doorstep Mechanic Saad",
    primary_service: "mechanic",
    skills: ["battery_jumpstart", "tyre_change", "minor_engine"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Islamabad", area: "G-11", lat: 33.6679, lng: 72.9988,
    rating_avg: 4.4, rating_count: 65, recent_negative_review_count: 1,
    on_time_score: 0.85, cancel_rate: 0.07,
    hourly_rate: 1000, visit_fee: 400, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn"],
    bio: "Mobile mechanic. Comes to your car.",
  },

  // ===== Islamabad — carpentry =====
  {
    name: "WoodWorks Studio",
    primary_service: "carpentry",
    skills: ["furniture_repair", "door_install", "custom_shelf"],
    specialization_level: "complex",
    certifications: [],
    city: "Islamabad", area: "I-10", lat: 33.6650, lng: 73.0608,
    rating_avg: 4.6, rating_count: 78, recent_negative_review_count: 0,
    on_time_score: 0.90, cancel_rate: 0.04,
    hourly_rate: 1100, visit_fee: 300, daily_capacity: 4,
    gender: "male", languages: ["ur-Latn"],
    bio: "Custom carpentry, furniture repair, and door installation.",
  },

  // ===== Islamabad — appliance_repair =====
  {
    name: "ApplianceMD",
    primary_service: "appliance_repair",
    skills: ["fridge_repair", "washing_machine", "microwave"],
    specialization_level: "complex",
    certifications: ["dawlance_authorized"],
    city: "Islamabad", area: "F-11", lat: 33.6822, lng: 72.9885,
    rating_avg: 4.7, rating_count: 145, recent_negative_review_count: 0,
    on_time_score: 0.92, cancel_rate: 0.03,
    hourly_rate: 1200, visit_fee: 400, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Brand-authorized appliance technician.",
  },

  // ===== Rawalpindi — AC =====
  {
    name: "Pindi Cool Tech",
    primary_service: "ac_repair",
    skills: ["split_ac_service", "window_ac_service", "gas_refill"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Rawalpindi", area: "Saddar", lat: 33.5969, lng: 73.0418,
    rating_avg: 4.4, rating_count: 102, recent_negative_review_count: 2,
    on_time_score: 0.83, cancel_rate: 0.09,
    hourly_rate: 800, visit_fee: 250, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn"],
    bio: "AC service across Rawalpindi cantonment.",
  },
  {
    name: "InverterFix Rawalpindi",
    primary_service: "ac_repair",
    skills: ["inverter_diagnosis", "split_ac_install", "pcb_repair"],
    specialization_level: "complex",
    certifications: ["split_ac_certified"],
    city: "Rawalpindi", area: "Bahria Town Phase 4", lat: 33.5285, lng: 73.0826,
    rating_avg: 4.7, rating_count: 156, recent_negative_review_count: 0,
    on_time_score: 0.93, cancel_rate: 0.03,
    hourly_rate: 1300, visit_fee: 400, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Inverter AC specialist. Bahria + DHA coverage.",
  },

  // ===== Rawalpindi — plumbing / electrical =====
  {
    name: "Saddar Plumbers",
    primary_service: "plumbing",
    skills: ["leak_repair", "tap_install", "drain_clearance"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Rawalpindi", area: "Saddar", lat: 33.5995, lng: 73.0395,
    rating_avg: 4.3, rating_count: 71, recent_negative_review_count: 1,
    on_time_score: 0.82, cancel_rate: 0.07,
    hourly_rate: 700, visit_fee: 200, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn"],
    bio: "Plumbing across Pindi.",
  },
  {
    name: "DHA Electrician Hub",
    primary_service: "electrical",
    skills: ["wiring", "ups_setup", "fan_install", "solar_inverter"],
    specialization_level: "complex",
    certifications: ["pec_certified"],
    city: "Rawalpindi", area: "DHA Phase 2", lat: 33.5305, lng: 73.1432,
    rating_avg: 4.6, rating_count: 132, recent_negative_review_count: 0,
    on_time_score: 0.91, cancel_rate: 0.04,
    hourly_rate: 1200, visit_fee: 350, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Premium electrical service in DHA.",
  },

  // ===== Lahore — AC =====
  {
    name: "Lahore AC Experts",
    primary_service: "ac_repair",
    skills: ["split_ac_service", "inverter_diagnosis", "split_ac_install"],
    specialization_level: "complex",
    certifications: ["split_ac_certified", "pec_certified"],
    city: "Lahore", area: "DHA Phase 5", lat: 31.4720, lng: 74.4055,
    rating_avg: 4.8, rating_count: 287, recent_negative_review_count: 0,
    on_time_score: 0.95, cancel_rate: 0.02,
    hourly_rate: 1400, visit_fee: 450, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Lahore's top-rated AC specialist.",
  },
  {
    name: "Gulberg AC Service",
    primary_service: "ac_repair",
    skills: ["window_ac_service", "split_ac_service", "general_diagnosis"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Lahore", area: "Gulberg III", lat: 31.5170, lng: 74.3445,
    rating_avg: 4.4, rating_count: 112, recent_negative_review_count: 1,
    on_time_score: 0.84, cancel_rate: 0.07,
    hourly_rate: 900, visit_fee: 300, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn"],
    bio: "Reliable AC service in Gulberg.",
  },

  // ===== Lahore — plumbing / electrical / cleaning =====
  {
    name: "Gulberg Plumbers Network",
    primary_service: "plumbing",
    skills: ["leak_repair", "drain_clearance", "geyser_install"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Lahore", area: "Gulberg II", lat: 31.5189, lng: 74.3491,
    rating_avg: 4.5, rating_count: 99, recent_negative_review_count: 1,
    on_time_score: 0.88, cancel_rate: 0.05,
    hourly_rate: 800, visit_fee: 250, daily_capacity: 6,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Plumbing across central Lahore.",
  },
  {
    name: "Model Town Electricians",
    primary_service: "electrical",
    skills: ["wiring", "breaker_install", "ups_setup"],
    specialization_level: "complex",
    certifications: ["pec_certified"],
    city: "Lahore", area: "Model Town", lat: 31.4781, lng: 74.3243,
    rating_avg: 4.7, rating_count: 174, recent_negative_review_count: 0,
    on_time_score: 0.92, cancel_rate: 0.03,
    hourly_rate: 1250, visit_fee: 350, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Quality electrical work in Lahore.",
  },
  {
    name: "CleanLahore Pro",
    primary_service: "cleaning",
    skills: ["deep_clean", "post_construction", "sofa_shampoo"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Lahore", area: "DHA Phase 6", lat: 31.4794, lng: 74.4259,
    rating_avg: 4.6, rating_count: 198, recent_negative_review_count: 0,
    on_time_score: 0.90, cancel_rate: 0.04,
    hourly_rate: 700, visit_fee: 0, daily_capacity: 6,
    languages: ["ur-Latn", "en"],
    bio: "Deep cleaning specialists.",
  },

  // ===== Lahore — beauty / tutoring / appliance / mechanic =====
  {
    name: "BeautyAtDoor Lahore",
    primary_service: "beauty",
    skills: ["facial", "haircut", "bridal", "threading"],
    specialization_level: "complex",
    certifications: ["salon_certified"],
    city: "Lahore", area: "Johar Town", lat: 31.4685, lng: 74.2730,
    rating_avg: 4.8, rating_count: 322, recent_negative_review_count: 0,
    on_time_score: 0.94, cancel_rate: 0.03,
    hourly_rate: 1800, visit_fee: 0, daily_capacity: 4,
    gender: "female", languages: ["ur-Latn", "en"],
    bio: "Premium home salon services for women.",
  },
  {
    name: "TutorLine Lahore",
    primary_service: "tutoring",
    skills: ["english_olevel", "matric_science", "computer_science"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Lahore", area: "Cantt", lat: 31.5050, lng: 74.3946,
    rating_avg: 4.5, rating_count: 64, recent_negative_review_count: 0,
    on_time_score: 0.91, cancel_rate: 0.03,
    hourly_rate: 1500, visit_fee: 0, daily_capacity: 4,
    languages: ["en", "ur-Latn"],
    bio: "Subject tutors across Lahore.",
  },
  {
    name: "Lahore Appliance Doctor",
    primary_service: "appliance_repair",
    skills: ["fridge_repair", "washing_machine", "microwave", "dishwasher"],
    specialization_level: "complex",
    certifications: ["haier_authorized"],
    city: "Lahore", area: "DHA Phase 4", lat: 31.4790, lng: 74.4123,
    rating_avg: 4.7, rating_count: 156, recent_negative_review_count: 0,
    on_time_score: 0.93, cancel_rate: 0.03,
    hourly_rate: 1300, visit_fee: 400, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn", "en"],
    bio: "Authorized appliance repair.",
  },
  {
    name: "Lahore Mobile Mechanic",
    primary_service: "mechanic",
    skills: ["battery_jumpstart", "tyre_change", "minor_engine", "oil_change"],
    specialization_level: "intermediate",
    certifications: [],
    city: "Lahore", area: "Gulberg III", lat: 31.5165, lng: 74.3460,
    rating_avg: 4.3, rating_count: 87, recent_negative_review_count: 2,
    on_time_score: 0.81, cancel_rate: 0.09,
    hourly_rate: 1100, visit_fee: 450, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn"],
    bio: "Doorstep auto mechanic.",
  },

  // ===== Edge-case providers (for stress tests) =====
  {
    name: "FlakyFix AC",
    primary_service: "ac_repair",
    skills: ["window_ac_service", "general_diagnosis"],
    specialization_level: "basic",
    certifications: [],
    city: "Islamabad", area: "G-13", lat: 33.6470, lng: 72.9755,
    rating_avg: 4.4, rating_count: 51, recent_negative_review_count: 4, // recent dip
    on_time_score: 0.70, cancel_rate: 0.18,                              // high cancel rate
    hourly_rate: 850, visit_fee: 300, daily_capacity: 5,
    gender: "male", languages: ["ur-Latn"],
    bio: "Cheap and quick - reviews mixed lately.",
  },
];
