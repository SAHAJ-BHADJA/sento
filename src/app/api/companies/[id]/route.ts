import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { discoverForCompany } from "@/lib/engine";

const Patch = z.object({
  active: z.boolean().optional(),
  repoll: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  let discovered = 0;
  if (typeof parsed.data.active === "boolean") {
    await prisma.company.update({ where: { id: company.id }, data: { active: parsed.data.active } });
  }
  if (parsed.data.repoll) {
    discovered = await discoverForCompany(company).catch(() => 0);
  }
  const updated = await prisma.company.findUnique({
    where: { id: company.id },
    include: { _count: { select: { jobs: true } } },
  });
  return NextResponse.json({ company: updated, discovered });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.company.delete({ where: { id: company.id } });
  return NextResponse.json({ ok: true });
}
