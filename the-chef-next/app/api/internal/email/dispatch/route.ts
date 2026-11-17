import { NextResponse } from "next/server";
import { dispatchQueuedEmails } from "@/lib/email/dispatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const outcome = await dispatchQueuedEmails();
    if (!outcome.configured)
      return NextResponse.json({ error: "Email provider not configured", claimed: 0 }, { status: 503 });
    return NextResponse.json({ processed: outcome.processed });
  } catch {
    return NextResponse.json({ error: "Could not claim outbox" }, { status: 500 });
  }
}
