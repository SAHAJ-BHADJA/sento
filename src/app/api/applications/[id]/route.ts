import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { processApplication } from "@/lib/engine";

const Action = z.object({
  action: z.enum(["approve", "skip", "mark_submitted", "retry"]),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const app = await prisma.application.findFirst({
    where: { id: params.id, userId },
    include: { job: { include: { company: true } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ application: app });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const app = await prisma.application.findFirst({ where: { id: params.id, userId } });
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  switch (parsed.data.action) {
    case "skip":
      await prisma.application.update({ where: { id: app.id }, data: { status: "SKIPPED" } });
      return NextResponse.json({ ok: true, status: "SKIPPED" });
    case "mark_submitted":
      // User completed a NEEDS_YOU step by hand (e.g. solved a CAPTCHA).
      await prisma.$transaction([
        prisma.application.update({
          where: { id: app.id },
          data: { status: "SUBMITTED", submittedAt: new Date(), needsReason: null },
        }),
        prisma.user.update({ where: { id: userId }, data: { credits: { decrement: 1 } } }),
      ]);
      return NextResponse.json({ ok: true, status: "SUBMITTED" });
    case "approve":
    case "retry": {
      // Queue it and run the submission pipeline now.
      await prisma.application.update({ where: { id: app.id }, data: { status: "QUEUED" } });
      const status = await processApplication(app.id);
      return NextResponse.json({ ok: true, status });
    }
  }
}
