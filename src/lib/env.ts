// Centralized, lazy environment access. Nothing throws at import time so the
// app always builds; each capability reports whether it is configured.

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const env = {
  databaseUrl: str("DATABASE_URL"),
  nextAuthSecret: str("NEXTAUTH_SECRET", "dev-insecure-secret"),

  anthropicApiKey: str("ANTHROPIC_API_KEY"),
  model: str("SENTO_MODEL", "claude-opus-4-8"),

  // OpenAI-compatible fallback (free options: Groq, Ollama, OpenRouter, Gemini).
  llmBaseUrl: str("SENTO_LLM_BASE_URL"),
  llmModel: str("SENTO_LLM_MODEL"),
  llmApiKey: str("SENTO_LLM_API_KEY"),

  stripeSecretKey: str("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: str("STRIPE_WEBHOOK_SECRET"),

  pollIntervalSeconds: int("SENTO_POLL_INTERVAL_SECONDS", 900),
  matchThreshold: int("SENTO_MATCH_THRESHOLD", 70),
  requireApproval: bool("SENTO_REQUIRE_APPROVAL", true),
  headful: bool("SENTO_HEADFUL", false),
};

export const capabilities = {
  tailoring: () =>
    env.anthropicApiKey.length > 0 || (env.llmBaseUrl.length > 0 && env.llmModel.length > 0),
  billing: () => env.stripeSecretKey.length > 0,
  database: () => env.databaseUrl.length > 0,
};
