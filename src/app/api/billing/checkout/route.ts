import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { createCheckoutSession } from "@/lib/billing";

const Body = z.object({ plan: z.enum(["STARTER", "PRO", "POWER"]) });

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const origin = new URL(req.url).origin;
  const url = await createCheckoutSession(parsed.data.plan, user.email, origin);
  if (!url) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  return NextResponse.json({ url });
}
