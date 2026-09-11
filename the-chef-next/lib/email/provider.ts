import "server-only";

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

export function configuredEmailProvider(): EmailProvider {
  throw new EmailProviderNotConfiguredError();
}
