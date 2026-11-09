import "server-only";
import { createHmac } from "node:crypto";

export function privacyFingerprint(value: string) {
  const secret = process.env.INQUIRY_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("Privacy fingerprint secret is not configured");
  return createHmac("sha256", secret).update(value || "unavailable").digest("hex");
}
