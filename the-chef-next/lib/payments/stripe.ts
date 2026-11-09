import "server-only";
import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe test-mode credentials are not configured.");
    this.name = "StripeNotConfiguredError";
  }
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_"))
    throw new Error("Phase 3 accepts Stripe test-mode keys only.");
  return new Stripe(key);
}

export function stripeWebhookSecret() {
  const value = process.env.STRIPE_WEBHOOK_SECRET;
  if (!value) throw new StripeNotConfiguredError();
  return value;
}
