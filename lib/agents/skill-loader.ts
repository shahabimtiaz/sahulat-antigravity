/**
 * Antigravity Skill Loader.
 *
 * Reads `.agent/skills/<name>/SKILL.md` at runtime, parses its YAML
 * frontmatter, and exposes the markdown body for use as a system prompt.
 * This makes the Antigravity skill files the SINGLE SOURCE OF TRUTH for
 * agent behavior — runtime + Antigravity IDE share the exact same prompt.
 *
 * Cache strategy: skills are loaded once per Node process. Set
 * `OMC_SKILL_HOT_RELOAD=true` in dev to bypass the cache.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export type SkillFrontmatter = {
  name: string;
  description: string;
  [k: string]: string;
};

export type Skill = {
  /** Logical skill name (filename if not in frontmatter). */
  name: string;
  description: string;
  /** Raw markdown body (everything after the closing `---`). */
  body: string;
  /** All frontmatter fields. */
  frontmatter: SkillFrontmatter;
  /** Absolute path to the SKILL.md file. */
  path: string;
};

const SKILLS_DIR = path.join(process.cwd(), ".agent", "skills");
const WORKFLOWS_DIR = path.join(process.cwd(), ".agent", "workflows");
const RULES_DIR = path.join(process.cwd(), ".agent", "rules");

const cache = new Map<string, Skill>();
let listed: Skill[] | null = null;

function isHot() {
  return process.env.OMC_SKILL_HOT_RELOAD === "true";
}

// ---------- minimal YAML frontmatter parser ----------
// Handles the subset our skills use: top-level scalar key: value pairs.
function parseFrontmatter(raw: string): { fm: SkillFrontmatter; body: string } {
  if (!raw.startsWith("---")) {
    return { fm: { name: "", description: "" }, body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { fm: { name: "", description: "" }, body: raw };

  const fmRaw = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const fm: SkillFrontmatter = { name: "", description: "" };
  for (const line of fmRaw.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    fm[m[1]] = v;
  }
  return { fm, body };
}

async function loadFile(name: string, dir: string): Promise<Skill | null> {
  const file = path.join(dir, name, "SKILL.md");
  // Allow workflows/rules to live as a single file too.
  const single = path.join(dir, `${name}.md`);
  let target: string;
  try {
    await fs.access(file);
    target = file;
  } catch {
    try {
      await fs.access(single);
      target = single;
    } catch {
      return null;
    }
  }
  const raw = await fs.readFile(target, "utf8");
  const { fm, body } = parseFrontmatter(raw);
  return {
    name: fm.name || name,
    description: fm.description,
    body: body.trim(),
    frontmatter: fm,
    path: target,
  };
}

export async function loadSkill(name: string): Promise<Skill> {
  if (!isHot() && cache.has(name)) return cache.get(name)!;
  const s = await loadFile(name, SKILLS_DIR);
  if (!s) throw new Error(`Skill not found: ${name}`);
  cache.set(name, s);
  return s;
}

export async function loadWorkflow(name: string): Promise<Skill> {
  const key = `workflow:${name}`;
  if (!isHot() && cache.has(key)) return cache.get(key)!;
  const s = await loadFile(name, WORKFLOWS_DIR);
  if (!s) throw new Error(`Workflow not found: ${name}`);
  cache.set(key, s);
  return s;
}

export async function loadRule(name: string): Promise<Skill> {
  const key = `rule:${name}`;
  if (!isHot() && cache.has(key)) return cache.get(key)!;
  const s = await loadFile(name, RULES_DIR);
  if (!s) throw new Error(`Rule not found: ${name}`);
  cache.set(key, s);
  return s;
}

export async function listSkills(): Promise<Skill[]> {
  if (!isHot() && listed) return listed;
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const out: Skill[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const s = await loadFile(e.name, SKILLS_DIR);
      if (s) out.push(s);
    }
    listed = out;
    return out;
  } catch (e) {
    console.warn("listSkills failed:", (e as Error).message);
    return [];
  }
}

export async function listWorkflows(): Promise<Skill[]> {
  try {
    const entries = await fs.readdir(WORKFLOWS_DIR, { withFileTypes: true });
    const out: Skill[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const base = e.name.replace(/\.md$/, "");
      const s = await loadFile(base, WORKFLOWS_DIR);
      if (s) out.push(s);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Compose a runtime system prompt from a skill + optional extras.
 * The skill body becomes the procedural backbone; extras are appended.
 */
export function composeSystemPrompt(skill: Skill, extras: string[] = []): string {
  const header = `You are operating as the Antigravity skill "${skill.name}".\n` +
                 `Description: ${skill.description}\n\n` +
                 `--- SKILL BODY (authoritative) ---\n`;
  return header + skill.body + (extras.length ? "\n\n--- ADDITIONAL CONTEXT ---\n" + extras.join("\n\n") : "");
}

/**
 * Provenance — what skill drove this run, body length, and a short stable hash
 * of the markdown body. Recorded on every TraceEvent so each artifact can be
 * traced back to the exact Antigravity skill version that produced it.
 */
export type SkillProvenance = { skill: string; body_length: number; body_hash: string };

const provenanceCache = new Map<string, SkillProvenance>();

function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function getSkillProvenance(name: string, kind: "skill" | "workflow" = "skill"): Promise<SkillProvenance> {
  const key = `${kind}:${name}`;
  if (!isHot() && provenanceCache.has(key)) return provenanceCache.get(key)!;
  const s = kind === "workflow" ? await loadWorkflow(name) : await loadSkill(name);
  const prov: SkillProvenance = {
    skill: `${kind}:${s.name}`,
    body_length: s.body.length,
    body_hash: djb2(s.body),
  };
  provenanceCache.set(key, prov);
  return prov;
}

/** Synchronous accessor — returns cached provenance or a placeholder. */
export function getCachedProvenance(name: string, kind: "skill" | "workflow" = "skill"): SkillProvenance {
  return provenanceCache.get(`${kind}:${name}`) ?? { skill: `${kind}:${name}`, body_length: 0, body_hash: "uncached" };
}
