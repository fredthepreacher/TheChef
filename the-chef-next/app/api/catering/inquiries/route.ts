import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { inquirySchema } from "@/lib/crm/domain";
import { intakeClient } from "@/lib/supabase/intake";
import { packages } from "@/data/menu";
export const runtime = "nodejs";
const TURNSTILE_ALWAYS_PASS_TEST_SECRET =
  "1x0000000000000000000000000000000AA";
const reply = (message: string, status: number) =>
  NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function POST(request: NextRequest) {
  const origin = process.env.APP_ORIGIN;
  if (!origin)
    return reply(
      "Online inquiries are temporarily unavailable. Please call Chef directly.",
      503,
    );
  if (request.headers.get("origin") !== origin)
    return reply("Request origin not allowed.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply("JSON required.", 415);
  const reader = request.body?.getReader();
  if (!reader) return reply("Inquiry required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24000) {
      await reader.cancel();
      return reply("Inquiry is too large.", 413);
    }
    chunks.push(value);
  }
  let input: unknown;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply("Invalid inquiry.", 400);
  }
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success)
    return reply(
      "Please check your contact information, event date, guest count and consent.",
      400,
    );
  const secret = process.env.INQUIRY_RATE_LIMIT_SECRET;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY ||
    !secret
  )
    return reply(
      "Online inquiries are temporarily unavailable. Please call Chef directly.",
      503,
    );
  const local =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_LOCAL_INQUIRIES === "true";
  if (!local) {
    if (!process.env.TURNSTILE_SECRET_KEY || !parsed.data.turnstile_token)
      return reply("Please complete the spam protection check.", 503);
    try {
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: parsed.data.turnstile_token,
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      const result = await response.json();
      const originHostname = new URL(origin).hostname;
      const usesLocalTurnstileTestKey =
        process.env.TURNSTILE_SECRET_KEY ===
          TURNSTILE_ALWAYS_PASS_TEST_SECRET &&
        (originHostname === "localhost" || originHostname === "127.0.0.1");
      if (
        !response.ok ||
        !result.success ||
        (!usesLocalTurnstileTestKey &&
          (result.hostname !== originHostname ||
            result.action !== "catering_inquiry"))
      )
        return reply("Spam protection expired. Please try again.", 400);
    } catch {
      return reply(
        "Spam protection is temporarily unavailable. Please try again.",
        503,
      );
    }
  }
  const { turnstile_token, website, ...inquiry } = parsed.data;
  void turnstile_token;
  void website;
  const hash = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex");
  // Vercel overwrites this header. Other hosts share a conservative global limit.
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "local-or-self-hosted";
  const snapshot = packages.find(
    (p) => p.badge === inquiry.package_interest,
  ) ?? {
    badge: inquiry.package_interest,
    price: { prefix: "Custom", strong: "Pricing" },
  };
  try {
    const { error } = await intakeClient().rpc("submit_catering_inquiry", {
      p_id: inquiry.request_id,
      p_inquiry: inquiry,
      p_snapshot: snapshot,
      p_network_key: `ip:${hash(ip)}`,
      p_email_key: `email:${hash(inquiry.email)}`,
    });
    if (error?.code === "P0003")
      return reply("Too many inquiries. Please try later or call Chef.", 429);
    if (error?.code === "P0002")
      return reply(
        "This request was already used. Reload before sending a different inquiry.",
        409,
      );
    if (error)
      return reply(
        "Your inquiry could not be saved. Please try again or call Chef.",
        503,
      );
    return reply(
      "Your catering inquiry has been received. Chef will contact you to discuss availability and your menu. This is not a confirmed booking.",
      201,
    );
  } catch {
    return reply(
      "Your inquiry could not be saved. Please try again or call Chef.",
      503,
    );
  }
}
