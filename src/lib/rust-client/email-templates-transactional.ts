/**
 * Email Suite — Transactional Templates Rust client.
 *
 * Thin typed wrappers around the `/v1/email/templates/transactional/*`
 * endpoints exposed by the `email-templates-transactional` Rust crate.
 * Distinct from the marketing-side `email-templates.ts` client.
 *
 * All calls flow through `rustFetch`, which attaches the JWT.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type TransactionalVarKind = 'string' | 'number' | 'boolean' | 'date';

export interface TransactionalVarSchemaEntry {
  name: string;
  kind: TransactionalVarKind;
  required?: boolean;
  default?: unknown;
  description?: string;
  pattern?: string;
}

export interface TransactionalTemplateDoc {
  _id: string;
  userId: string;
  name: string;
  key: string;
  subject: string;
  preheader?: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  vars: TransactionalVarSchemaEntry[];
  archived: boolean;
  keyHistory?: string[];
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

const BASE = '/v1/email/templates/transactional';

export function listTransactionalTemplates(opts?: {
  page?: number;
  limit?: number;
  q?: string;
  archived?: boolean;
}) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  if (opts?.q) qs.set('q', opts.q);
  if (opts?.archived !== undefined) qs.set('archived', String(opts.archived));
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<TransactionalTemplateDoc>>(`${BASE}${tail}`);
}

export function getTransactionalTemplate(id: string) {
  return rustFetch<TransactionalTemplateDoc>(`${BASE}/${id}`);
}

export interface CreateTransactionalTemplateInput {
  name: string;
  key: string;
  subject: string;
  preheader?: string;
  htmlBody: string;
  textBody?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  vars?: TransactionalVarSchemaEntry[];
}

export function createTransactionalTemplate(body: CreateTransactionalTemplateInput) {
  return rustFetch<TransactionalTemplateDoc>(BASE, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTransactionalTemplate(
  id: string,
  body: Partial<CreateTransactionalTemplateInput> & { archived?: boolean },
) {
  return rustFetch<TransactionalTemplateDoc>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteTransactionalTemplate(id: string) {
  return rustFetch<{ message: string }>(`${BASE}/${id}`, { method: 'DELETE' });
}

export interface TransactionalPreviewResponse {
  subject: string;
  html: string;
  text?: string;
  missingVars: string[];
}

export function previewTransactionalTemplate(id: string, vars: Record<string, unknown>) {
  return rustFetch<TransactionalPreviewResponse>(`${BASE}/${id}/preview`, {
    method: 'POST',
    body: JSON.stringify({ vars }),
  });
}

export function testSendTransactionalTemplate(
  id: string,
  toEmails: string[],
  vars: Record<string, unknown> = {},
) {
  return rustFetch<{ queued: number; note?: string }>(`${BASE}/${id}/test-send`, {
    method: 'POST',
    body: JSON.stringify({ toEmails, vars }),
  });
}
