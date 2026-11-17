"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase/service";
import { privacyFingerprint } from "@/lib/security/fingerprint";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function acceptProposal(form: FormData) {
  const parsed = z
    .object({
      token: tokenSchema,
      typed_name: z.string().trim().min(2).max(200),
      consent: z.literal("true"),
    })
    .safeParse(Object.fromEntries(form));
  const fallback = encodeURIComponent(String(form.get("token") ?? ""));
  if (!parsed.success) redirect(`/proposal/${fallback}?error=acceptance`);
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = privacyFingerprint(forwarded || "unavailable");
  const consentText =
    "I agree to the catering proposal and service agreement shown above and intend to accept electronically.";
  const db = serviceClient();
  const { error } = await db.rpc("accept_proposal_by_token", {
    p_token_sha256: tokenHash(parsed.data.token),
    p_typed_name: parsed.data.typed_name,
    p_consent_text: consentText,
    p_ip_hash: ipHash,
    p_user_agent: requestHeaders.get("user-agent") ?? "",
  });
  if (error) redirect(`/proposal/${parsed.data.token}?error=unavailable`);
  redirect(`/proposal/${parsed.data.token}?accepted=1`);
}

export async function respondToProposal(form: FormData) {
  const parsed = z
    .object({
      token: tokenSchema,
      response: z.enum(["declined", "revision_requested"]),
      message: z.string().trim().max(4000).default(""),
    })
    .safeParse(Object.fromEntries(form));
  const fallback = encodeURIComponent(String(form.get("token") ?? ""));
  if (!parsed.success) redirect(`/proposal/${fallback}?error=response`);
  const db = serviceClient();
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { error } = await db.rpc("respond_to_proposal_by_token", {
    p_token_sha256: tokenHash(parsed.data.token),
    p_response: parsed.data.response,
    p_message: parsed.data.message,
    p_network_hash: privacyFingerprint(forwarded || "unavailable"),
  });
  if (error) redirect(`/proposal/${parsed.data.token}?error=unavailable`);
  redirect(`/proposal/${parsed.data.token}?responded=1`);
}
