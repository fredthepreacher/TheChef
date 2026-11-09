import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await serviceClient().rpc("process_due_scheduled_actions", { p_limit: 20 });
  if (error) return NextResponse.json({ error: "Automation processing failed" }, { status: 500 });
  return NextResponse.json({ processed: data });
}
