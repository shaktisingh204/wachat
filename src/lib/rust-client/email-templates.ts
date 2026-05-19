/**
 * Email Suite — Templates Rust client (talks to `email-templates` Rust crate).
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type { EmailBuilderDocument } from '@/lib/email/types';

export interface EmailTemplateDoc {
  _id: string;
  userId: string;
  name: string;
  subject?: string;
  category?: string;
  builderJson?: EmailBuilderDocument;
  mjml?: string;
  html?: string;
  thumbnailUrl?: string;
  isLibrary?: boolean;
  version: number;
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

export interface RenderResult {
  html: string;
  mjml: string;
  warnings: string[];
}

export function listEmailTemplates(opts?: { page?: number; limit?: number; category?: string }) {
  const qs = new URLSearchParams();
  if (opts?.page)     qs.set('page', String(opts.page));
  if (opts?.limit)    qs.set('limit', String(opts.limit));
  if (opts?.category) qs.set('category', opts.category);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailTemplateDoc>>(`/v1/email/templates${tail}`);
}

export function createEmailTemplate(body: { name: string; subject?: string; builderJson?: EmailBuilderDocument; category?: string; mjml?: string; }) {
  return rustFetch<EmailTemplateDoc>('/v1/email/templates', { method: 'POST', body: JSON.stringify(body) });
}

export function getEmailTemplate(id: string) {
  return rustFetch<EmailTemplateDoc>(`/v1/email/templates/${id}`);
}

export function updateEmailTemplate(id: string, patch: Partial<EmailTemplateDoc>) {
  return rustFetch<EmailTemplateDoc>(`/v1/email/templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteEmailTemplate(id: string) {
  return rustFetch<void>(`/v1/email/templates/${id}`, { method: 'DELETE' });
}

export function renderEmailTemplate(id: string) {
  return rustFetch<RenderResult>(`/v1/email/templates/${id}/render`, { method: 'POST' });
}

export function listLibraryTemplates() {
  return rustFetch<EmailTemplateDoc[]>('/v1/email/templates/library');
}
