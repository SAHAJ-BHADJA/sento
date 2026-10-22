import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSupported } from "@/lib/ats";
import { currentUserId } from "@/lib/session";
import { discoverForCompany } from "@/lib/engine";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { jobs: true } } },
  });
  return NextResponse.json({ companies });
}

const AddCompany = z.object({
  name: z.string().min(1),
  atsType: z.enum(["GREENHOUSE", "LEVER", "ASHBY", "WORKDAY", "OTHER"]),
  atsIdentifier: z.string().min(1),
  careersUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = AddCompany.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  if (!isSupported(data.atsType)) {
    return NextResponse.json(
      { error: `ATS "${data.atsType}" is not yet supported for discovery` },
      { status: 422 },
    );
  }

  const company = await prisma.company.upsert({
    where: { atsType_atsIdentifier: { atsType: data.atsType, atsIdentifier: data.atsIdentifier } },
    create: { ...data, careersUrl: data.careersUrl ?? null },
    update: { name: data.name, active: true },
  });

  // Kick an immediate discovery so the board populates right away.
  const created = await discoverForCompany(company).catch(() => 0);
  return NextResponse.json({ company, discovered: created });
}
