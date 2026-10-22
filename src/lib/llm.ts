import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

// Unified completion interface. Prefers Anthropic when configured, otherwise
// falls back to any OpenAI-compatible endpoint (Groq, Ollama, OpenRouter,
// Gemini's OpenAI-compatible API, ...). Returns null when nothing is set.

let anthropicClient: Anthropic | null = null;

export function tailoringAvailable(): boolean {
  if (env.anthropicApiKey) return true;
  return Boolean(env.llmBaseUrl && env.llmModel);
}

export function providerLabel(): string {
  if (env.anthropicApiKey) return `anthropic:${env.model}`;
  if (env.llmBaseUrl && env.llmModel) return `openai-compatible:${env.llmModel}`;
  return "none";
}

async function completeAnthropic(system: string, user: string, maxTokens: number): Promise<string> {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  const res = await anthropicClient.messages.create({
    model: env.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function completeOpenAICompatible(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const base = env.llmBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.llmApiKey ? { authorization: `Bearer ${env.llmApiKey}` } : {}),
    },
    body: JSON.stringify({
      model: env.llmModel,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM endpoint returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/**
 * Single-shot completion. Returns the model's text, or null when no provider
 * is configured.
 */
export async function complete(
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<string | null> {
  if (env.anthropicApiKey) return completeAnthropic(system, user, maxTokens);
  if (env.llmBaseUrl && env.llmModel) return completeOpenAICompatible(system, user, maxTokens);
  return null;
}
