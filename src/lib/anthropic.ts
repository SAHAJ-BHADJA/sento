import Anthropic from "@anthropic-ai/sdk";
import { env, capabilities } from "./env";

let client: Anthropic | null = null;

/** Returns a shared Anthropic client, or null when no key is configured. */
export function anthropic(): Anthropic | null {
  if (!capabilities.tailoring()) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

/**
 * Single-shot completion helper. Returns the concatenated text of the first
 * response, or null when tailoring is unavailable.
 */
export async function complete(
  system: string,
  user: string,
  maxTokens = 2048,
): Promise<string | null> {
  const a = anthropic();
  if (!a) return null;
  const res = await a.messages.create({
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
