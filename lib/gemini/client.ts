import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const PRO = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
const FAST = process.env.GEMINI_FAST_MODEL ?? "gemini-2.5-flash";

let _client: GoogleGenerativeAI | null = null;
function client() {
  if (!_client) {
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export type GenJsonOpts = {
  system: string;
  user: string;
  model?: "pro" | "fast";
  /** JSON schema (Gemini-compatible, simplified) — passed to responseSchema. */
  schema?: Record<string, unknown>;
  temperature?: number;
};

/** Returns parsed JSON. Throws on parse failure. */
export async function generateJSON<T = unknown>(opts: GenJsonOpts): Promise<{ data: T; modelId: string; latency_ms: number }> {
  const modelId = opts.model === "fast" ? FAST : PRO;
  const generationConfig: GenerationConfig = {
    temperature: opts.temperature ?? 0.2,
    responseMimeType: "application/json",
    ...(opts.schema ? { responseSchema: opts.schema as never } : {}),
  };
  const model = client().getGenerativeModel({
    model: modelId,
    systemInstruction: opts.system,
    generationConfig,
  });
  const t0 = Date.now();
  const result = await model.generateContent(opts.user);
  const text = result.response.text();
  const latency_ms = Date.now() - t0;
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
  return { data, modelId, latency_ms };
}

export const Models = { PRO, FAST };
