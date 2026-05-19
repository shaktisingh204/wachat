/**
 * Email Suite — Campaigns Rust client (talks to `email-campaigns` Rust crate).
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type EmailCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed';
export type EmailCampaignType = 'regular' | 'ab' | 'rss' | 'plain' | 'transactional';

export interface EmailCampaignDoc {
  _id: string;
  userId: string;
  name: string;
  type: EmailCampaignType;
  status: EmailCampaignStatus;
  subject: string;
  fromName: string;
  fromEmail: string;
  preheader?: string;
  body?: string;
  templateId?: string;
  brandKitId?: string;
  listIds?: string[];
  segmentIds?: string[];
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function listEmailCampaigns(opts?: { page?: number; limit?: number; status?: EmailCampaignStatus; type?: EmailCampaignType }) {
  const qs = new URLSearchParams();
  if (opts?.page)   qs.set('page', String(opts.page));
  if (opts?.limit)  qs.set('limit', String(opts.limit));
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.type)   qs.set('type', opts.type);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailCampaignDoc>>(`/v1/email/campaigns${tail}`);
}

export function createEmailCampaign(body: {
  name: string;
  type?: EmailCampaignType;
  subject: string;
  fromName: string;
  fromEmail: string;
  body?: string;
  templateId?: string;
  listIds?: string[];
  segmentIds?: string[];
  preheader?: string;
}) {
  return rustFetch<EmailCampaignDoc>('/v1/email/campaigns', { method: 'POST', body: JSON.stringify(body) });
}

export function getEmailCampaign(id: string) {
  return rustFetch<EmailCampaignDoc>(`/v1/email/campaigns/${id}`);
}

export function updateEmailCampaign(id: string, body: Partial<EmailCampaignDoc>) {
  return rustFetch<EmailCampaignDoc>(`/v1/email/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteEmailCampaign(id: string) {
  return rustFetch<void>(`/v1/email/campaigns/${id}`, { method: 'DELETE' });
}

export function sendEmailCampaign(id: string) {
  return rustFetch<{ ok: true; status: EmailCampaignStatus }>(`/v1/email/campaigns/${id}/send`, { method: 'POST' });
}

export function scheduleEmailCampaign(id: string, scheduledAt: string) {
  return rustFetch<EmailCampaignDoc>(`/v1/email/campaigns/${id}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledAt }),
  });
}

export function testSendEmailCampaign(id: string, toEmails: string[]) {
  return rustFetch<{ ok: true; queued: number }>(`/v1/email/campaigns/${id}/test-send`, {
    method: 'POST',
    body: JSON.stringify({ toEmails }),
  });
}

export function previewEmailCampaign(id: string) {
  return rustFetch<{ html: string; subject: string }>(`/v1/email/campaigns/${id}/preview`);
}

export function getEmailCampaignReport(id: string) {
  return rustFetch<{
    sent: number; delivered: number; opened: number; clicked: number;
    bounced: number; complained: number; unsubscribed: number;
  }>(`/v1/email/campaigns/${id}/report`);
}
