import type { NextConfig } from "next";

const config: NextConfig = {
  // Ensure the Antigravity skill files are bundled with the serverless / standalone
  // build so `lib/agents/skill-loader.ts` can read them at runtime. Without this,
  // Next.js' file tracer doesn't see the dynamic `fs.readFile` calls and the
  // .agent/ directory is dropped from the deploy artifact.
  outputFileTracingIncludes: {
    "/api/orchestrate": [".agent/**/*"],
    "/api/agents": [".agent/**/*"],
    "/api/reschedule": [".agent/**/*"],
    "/api/disputes": [".agent/**/*"],
    "/agents": [".agent/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "places.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default config;
