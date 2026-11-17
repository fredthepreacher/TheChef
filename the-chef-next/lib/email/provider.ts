import "server-only";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

export type EmailDelivery = {
  providerMessageId: string;
  acceptedAt: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailDelivery>;
}

export class EmailProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Transactional email provider is not configured. The outbox item remains queued.",
    );
    this.name = "EmailProviderNotConfiguredError";
  }
}

/** True when Resend can be used (key, From and Reply-To are all set). */
export function emailProviderConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.RESEND_REPLY_TO_EMAIL,
  );
}

export function configuredEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL;
  if (!apiKey || !from || !replyTo)
    throw new EmailProviderNotConfiguredError();
  const resend = new Resend(apiKey);
  return {
    name: "resend",
    async send(message) {
      const { data, error } = await resend.emails.send(
        {
          from,
          replyTo,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        },
        { idempotencyKey: message.idempotencyKey },
      );
      if (error || !data?.id)
        throw new Error(error?.message ?? "Resend did not return a message ID");
      return { providerMessageId: data.id, acceptedAt: new Date().toISOString() };
    },
  };
}
