import Stripe from "stripe";
import type { Plan } from "@prisma/client";
import { env, capabilities } from "./env";

let stripe: Stripe | null = null;
function client(): Stripe | null {
  if (!capabilities.billing()) return null;
  if (!stripe) stripe = new Stripe(env.stripeSecretKey);
  return stripe;
}

/** Application credits granted per billing plan (billed on submitted apps). */
export const PLAN_CREDITS: Record<Plan, number> = {
  FREE: 25,
  STARTER: 600,
  PRO: 1500,
  POWER: 4500,
};

export const PLAN_PRICE_ENV: Record<Exclude<Plan, "FREE">, string> = {
  STARTER: "STRIPE_PRICE_STARTER",
  PRO: "STRIPE_PRICE_PRO",
  POWER: "STRIPE_PRICE_POWER",
};

export function billingAvailable(): boolean {
  return capabilities.billing();
}

/** Create a Stripe Checkout session for a plan, or null when unconfigured. */
export async function createCheckoutSession(
  plan: Exclude<Plan, "FREE">,
  customerEmail: string,
  origin: string,
): Promise<string | null> {
  const s = client();
  const priceId = process.env[PLAN_PRICE_ENV[plan]];
  if (!s || !priceId) return null;
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=cancelled`,
    metadata: { plan },
  });
  return session.url;
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event | null {
  const s = client();
  if (!s || !env.stripeWebhookSecret) return null;
  return s.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
}
