import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { constructWebhookEvent, PLAN_CREDITS } from "@/lib/billing";
import type { Plan } from "@prisma/client";

// Stripe needs the raw request body to verify the signature.
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event | null;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  if (!event) return NextResponse.json({ error: "billing not configured" }, { status: 503 });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email ?? session.customer_details?.email ?? undefined;
    const plan = (session.metadata?.plan as Plan | undefined) ?? undefined;
    if (email && plan) {
      await prisma.user.updateMany({
        where: { email },
        data: {
          plan,
          credits: PLAN_CREDITS[plan],
          stripeCustomerId: (session.customer as string) ?? undefined,
        },
      });
    }
  }
  return NextResponse.json({ received: true });
}
