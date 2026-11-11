import { createHmac } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { inquirySchema } from "@/lib/crm/domain";
import { dispatchInquiryEmails } from "@/lib/email/dispatch";
import { intakeClient } from "@/lib/supabase/intake";
import { THANKSGIVING } from "@/data/thanksgiving";
import { prepareInquiry } from "@/lib/catering/prepare-inquiry";
import { visibleUnlessDraftInProduction } from "@/lib/site";
import { ownerNotificationRecipient } from "@/lib/email/owner-notification";
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
      "Please check your contact details, event date, guest count, event location and consent.",
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
  const { turnstile_token, website, ...fields } = parsed.data;
  void turnstile_token;
  void website;
  // Menu picks / feast order → menu_notes + package snapshot (see prepareInquiry).
  const { inquiry, snapshot, feast } = prepareInquiry(fields);
  if (feast && !visibleUnlessDraftInProduction(THANKSGIVING.approved))
    return reply("Thanksgiving orders are not open yet. Please call Chef directly.", 400);
  const hash = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex");
  // Vercel overwrites this header. Other hosts share a conservative global limit.
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "local-or-self-hosted";
  try {
    const client = intakeClient();
    const args = {
      p_id: inquiry.request_id,
      p_inquiry: inquiry,
      p_snapshot: snapshot,
      p_network_key: `ip:${hash(ip)}`,
      p_email_key: `email:${hash(inquiry.email)}`,
    };
    // Chef's new-inquiry alert is queued in the same transaction, only when
    // CHEF_NOTIFICATION_EMAIL is configured (6-argument overload).
    const owner = ownerNotificationRecipient();
    let { error } = await client.rpc(
      "submit_catering_inquiry",
      owner ? { ...args, p_owner_email: owner } : args,
    );
    if (owner && error?.code === "PGRST202") {
      // The overload's migration isn't applied yet: save the inquiry without
      // the alert rather than turning the customer away.
      console.error(
        "Chef inquiry alert skipped: migration 20261109220000_owner_inquiry_notification is not applied.",
      );
      ({ error } = await client.rpc("submit_catering_inquiry", args));
    }
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
    // Send this inquiry's own acknowledgment and Chef alert right after the
    // response, without delaying it. Only these two outbox items can be
    // claimed here; anything else stays queued for the operator. With no email
    // provider configured nothing is claimed and both stay queued.
    after(async () => {
      try {
        await dispatchInquiryEmails(inquiry.request_id);
      } catch {
        console.error("Inquiry email dispatch failed; the messages stay queued for retry.");
      }
    });
    return reply(
      feast
        ? "Your Thanksgiving order request is in. Chef Frankie will confirm availability, your sides and pies, and the details with you. Your feast is not reserved until Chef confirms your order."
        : "Your request is in. Chef Frankie will review availability, confirm your selections and send your custom quote. Your date is not reserved until your quote is approved and the required deposit is paid.",
      201,
    );
  } catch {
    return reply(
      "Your inquiry could not be saved. Please try again or call Chef.",
      503,
    );
  }
}
