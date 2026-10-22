import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true, credits: true },
  });
  return NextResponse.json({ profile, user });
}

const ProfileInput = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  location: z.string().optional().default(""),
  linkedinUrl: z.string().optional().default(""),
  websiteUrl: z.string().optional().default(""),
  githubUrl: z.string().optional().default(""),
  workAuthorization: z.string().optional().default(""),
  requiresSponsorship: z.boolean().default(false),
  titles: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  locationsPreferred: z.array(z.string()).default([]),
  remoteOnly: z.boolean().default(false),
  minSalary: z.number().int().nonnegative().nullable().optional(),
  baseResumeText: z.string().default(""),
  customAnswers: z.record(z.string(), z.string()).default({}),
});

function clean(arr: string[]): string[] {
  return arr.map((s) => s.trim()).filter(Boolean);
}

export async function PUT(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = ProfileInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const data = {
    fullName: d.fullName,
    email: d.email,
    phone: d.phone || null,
    location: d.location || null,
    linkedinUrl: d.linkedinUrl || null,
    websiteUrl: d.websiteUrl || null,
    githubUrl: d.githubUrl || null,
    workAuthorization: d.workAuthorization || null,
    requiresSponsorship: d.requiresSponsorship,
    titles: clean(d.titles),
    skills: clean(d.skills),
    locationsPreferred: clean(d.locationsPreferred),
    remoteOnly: d.remoteOnly,
    minSalary: d.minSalary ?? null,
    baseResumeText: d.baseResumeText,
    customAnswers: d.customAnswers as never,
  };

  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return NextResponse.json({ profile });
}
