import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { matchForUser, discoverAll } from "@/lib/engine";

// Manually trigger discovery + matching for the signed-in user. Submission is
// intentionally left to the worker / explicit approve action so a dashboard
// click never auto-fires real applications.
export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const discovered = await discoverAll();
  const matched = await matchForUser(userId);
  return NextResponse.json({ ok: true, discovered, matched });
}
