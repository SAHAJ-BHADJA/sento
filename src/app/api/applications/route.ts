import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status");
  const applications = await prisma.application.findMany({
    where: { userId, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { job: { include: { company: true } } },
  });
  return NextResponse.json({ applications });
}
