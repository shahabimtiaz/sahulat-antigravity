/**
 * Packages everything the InnoVista submission asks for under
 * "Antigravity Trace / Logs": implementation plans, task lists, walkthroughs,
 * agent traces.
 *
 * Run:
 *   pnpm bundle:antigravity
 *
 * Produces: antigravity-traces.zip in the repo root.
 *
 * Bundle contents:
 *   agent/                     full .agent/ snapshot (skills, workflows, rules, MCP)
 *   runtime-counterparts/      the lib/agents/*.ts files that mirror each skill
 *   docs/                      README.md, DEMO.md, SUBMISSION.md, IOS_SIMULATOR.md
 *   traces/traces.json         live export of the traces table
 *   traces/bundle-summary.md   human-readable index + stats
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, ".antigravity-bundle");
const OUT_ZIP = path.join(ROOT, "antigravity-traces.zip");

const RUNTIME_FILES = [
  "lib/agents/orchestrator.ts",
  "lib/agents/intent.ts",
  "lib/agents/matcher.ts",
  "lib/agents/pricer.ts",
  "lib/agents/scheduler.ts",
  "lib/agents/dispute.ts",
  "lib/agents/skill-loader.ts",
  "lib/agents/trace.ts",
  "lib/agents/types.ts",
];

const DOC_FILES = [
  "README.md",
  "DEMO.md",
  "SUBMISSION.md",
  "IOS_SIMULATOR.md",
];

async function rmrf(p: string) {
  await fs.rm(p, { recursive: true, force: true });
}

async function copyTree(src: string, dst: string) {
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.cp(src, dst, { recursive: true });
}

async function copyFile(src: string, dst: string) {
  try {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  } catch (e) {
    console.warn(`  skip ${src}: ${(e as Error).message}`);
  }
}

async function exportTraces(): Promise<{ rows: number; payload: unknown[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("  Supabase env not set — skipping live traces export");
    return { rows: 0, payload: [] };
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("traces")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    console.warn("  traces export error:", error.message);
    return { rows: 0, payload: [] };
  }
  return { rows: (data ?? []).length, payload: data ?? [] };
}

async function exportBookings(): Promise<{ rows: number; payload: unknown[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { rows: 0, payload: [] };
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("bookings")
    .select("id, service, status, scheduled_start, total_price, request_text, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return { rows: (data ?? []).length, payload: data ?? [] };
}

async function main() {
  console.log("Bundling Antigravity submission artifacts…\n");

  // 1. fresh staging dir
  await rmrf(OUT_DIR);
  await fs.mkdir(OUT_DIR, { recursive: true });

  // 2. .agent snapshot
  console.log("→ Copying .agent/ skills, workflows, rules, MCP config");
  try {
    await copyTree(path.join(ROOT, ".agent"), path.join(OUT_DIR, "agent"));
  } catch (e) {
    console.warn("  .agent copy failed:", (e as Error).message);
  }

  // 3. Runtime counterparts (the TS files each skill maps to)
  console.log("→ Copying runtime counterparts");
  for (const f of RUNTIME_FILES) {
    await copyFile(path.join(ROOT, f), path.join(OUT_DIR, "runtime-counterparts", path.basename(f)));
  }

  // 4. Docs
  console.log("→ Copying docs (README, DEMO, SUBMISSION, IOS_SIMULATOR)");
  for (const f of DOC_FILES) {
    await copyFile(path.join(ROOT, f), path.join(OUT_DIR, "docs", f));
  }

  // 5. Live traces export
  console.log("→ Exporting traces from Supabase");
  const traces = await exportTraces();
  const bookings = await exportBookings();
  await fs.mkdir(path.join(OUT_DIR, "traces"), { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, "traces", "traces.json"),
    JSON.stringify(traces.payload, null, 2),
  );
  await fs.writeFile(
    path.join(OUT_DIR, "traces", "bookings.json"),
    JSON.stringify(bookings.payload, null, 2),
  );

  // 6. Human-readable summary
  const summary = `# Antigravity bundle — index

Generated: ${new Date().toISOString()}

## Contents

| Path | Description |
|---|---|
| \`agent/skills/\` | 7 SKILL.md files — the authoritative procedural specs that drive each agent. Editable from inside the Antigravity IDE; loaded at runtime by \`lib/agents/skill-loader.ts\`. |
| \`agent/workflows/\` | 3 workflow definitions — \`book-service\`, \`handle-dispute\`, \`reschedule\`. The orchestrator records which workflow drives each run in the trace. |
| \`agent/rules/\` | Project-wide rules (coding standards) loaded by Antigravity at IDE start. |
| \`agent/mcp/\` | MCP server configuration (Supabase + MCP Toolbox for Databases) — these let Antigravity agents query the live DB during development. |
| \`runtime-counterparts/\` | The TypeScript files each SKILL.md drives at runtime. SKILL.md ↔ TS is intentional 1:1. |
| \`docs/\` | README (architecture + costs + baseline + scalability), DEMO (recording script), SUBMISSION (form-filling cheat sheet), IOS_SIMULATOR (run guide). |
| \`traces/traces.json\` | Live export of the \`traces\` table — every agent decision, with rationale, confidence, model id, latency, and skill provenance hash. ${traces.rows} rows. |
| \`traces/bookings.json\` | Live export of recent bookings. ${bookings.rows} rows. |

## Skills ↔ Runtime mapping

| Antigravity skill | Runtime file | What it does |
|---|---|---|
| \`intent-extraction\` | \`intent.ts\` | Multilingual parsing (Urdu, Roman Urdu, English) with confidence + clarifying questions. |
| \`provider-matching\` | \`matcher.ts\` | 11-factor weighted ranking with Bayesian rating correction. |
| \`dynamic-pricing\` | \`pricer.ts\` | Transparent line-item pricing with surge, urgency, loyalty. |
| \`scheduling\` | \`scheduler.ts\` | Slot reservation with travel-time buffer + alternates. |
| \`dispute-resolution\` | \`dispute.ts\` | 6 dispute case types with evidence-weighted decisions. |
| \`service-quality-loop\` | \`orchestrator.ts\` (post-completion path) | En-route → checklist → photo → review → reputation EWMA. |
| \`provider-optimization\` | \`app/api/providers/optimize/route.ts\` | Workload balance + demand forecast + recommended slots. |

## Workflows ↔ Runtime mapping

| Workflow | Triggered by | Runtime path |
|---|---|---|
| \`book-service\` | User submits a natural-language request | \`orchestrator.ts::orchestrate\` |
| \`handle-dispute\` | User or provider files a dispute | \`app/api/disputes/route.ts\` |
| \`reschedule\` | Provider cancels confirmed booking | \`app/api/reschedule/route.ts\` |

## Notes for evaluators

1. **Skill provenance**: every \`TraceEvent\` carries a \`skill\` field with
   \`{name, body_length, body_hash}\` so each artifact is traceable back to
   the exact SKILL.md version that produced it.
2. **Robustness evidence**: when the LLM is unavailable (quota / network /
   auth), the rule-based fallback fires and emits a distinct
   \`agent: "fallback"\` trace event with the failure classification. See
   \`traces.json\` for live examples.
3. **MCP**: the \`.agent/mcp/\` directory has the JSON config to wire
   Supabase MCP into Antigravity Settings → MCP. The agent then has
   read-only SQL access to the same DB this bundle exports from.
`;
  await fs.writeFile(path.join(OUT_DIR, "traces", "bundle-summary.md"), summary);

  // 7. zip
  console.log("→ Zipping antigravity-traces.zip");
  await rmrf(OUT_ZIP);
  // Use system zip; macOS and most Linux distros ship it.
  const result = spawnSync(
    "zip",
    ["-rq", OUT_ZIP, "."],
    { cwd: OUT_DIR, stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error("zip failed");
    process.exit(1);
  }

  // 8. cleanup
  await rmrf(OUT_DIR);

  const stat = await fs.stat(OUT_ZIP);
  console.log(`\n✓ Done: ${path.relative(ROOT, OUT_ZIP)}  (${(stat.size / 1024).toFixed(1)} KB)`);
  console.log(`  Traces:   ${traces.rows} rows`);
  console.log(`  Bookings: ${bookings.rows} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
