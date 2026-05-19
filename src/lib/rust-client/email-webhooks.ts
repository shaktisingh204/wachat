/**
 * Email Suite — Outbound Webhooks Rust client.
 *
 * Thin typed wrappers around `/v1/email/webhooks/*` exposed by the
 * `email-webhooks` Rust crate. The endpoint signs delivery payloads
 * with the `signingSecret`; clients display it but should not allow
 * re-fetching once dismissed.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type EmailWebhookEvent =
  | 'message.sent'
  | 'message.delivered'
  | 'message.opened'
  | 'message.clicked'
  | 'message.bounced'
  | 'message.complained'
  | 'message.unsubscribed'
  | 'campaign.completed'
  | 'journey.step.completed'
  | string;

export interface EmailWebhookDoc {
  _id: string;
  userId: string;
  name?: string;
  url: string;
  events: EmailWebhookEvent[];
  active: boolean;
  signingSecret?: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: number;
  failureCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailWebhookTestResult {
  status: number;
  durationMs: number;
  body?: string;
  error?: string;
}

export function listEmailWebhooks() {
  return rustFetch<{ items: EmailWebhookDoc[] }>('/v1/email/webhooks');
}

export function createEmailWebhook(body: {
  name?: string;
  url: string;
  events: EmailWebhookEvent[];
  active?: boolean;
}) {
  return rustFetch<EmailWebhookDoc>('/v1/email/webhooks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateEmailWebhook(
  id: string,
  body: {
    name?: string;
    url?: string;
    events?: EmailWebhookEvent[];
    active?: boolean;
  },
) {
  return rustFetch<EmailWebhookDoc>(`/v1/email/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEmailWebhook(id: string) {
  return rustFetch<void>(`/v1/email/webhooks/${id}`, { method: 'DELETE' });
}

export function testEmailWebhook(id: string) {
  return rustFetch<EmailWebhookTestResult>(`/v1/email/webhooks/${id}/test`, {
    method: 'POST',
  });
}
