/**
 * Email Suite — Audience Rust client.
 *
 * Thin typed wrappers around the `/v1/email/audience/*` endpoints exposed by
 * the `email-audience` Rust crate. All calls go through `rustFetch`, which
 * attaches the authenticated user's JWT.
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type {
  EmailFilterTree,
  EmailSubscriberStatus,
} from '@/lib/email/types';

export interface EmailListDoc {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
  subscriberCount?: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface EmailSubscriberDoc {
  _id: string;
  userId: string;
  listId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status: EmailSubscriberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSegmentDoc {
  _id: string;
  userId: string;
  listId?: string;
  name: string;
  description?: string;
  filter: EmailFilterTree;
  cachedCount?: number;
  cachedAt?: string;
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

export interface SegmentPreview {
  matches: number;
  sample: EmailSubscriberDoc[];
}

export interface TagWithCount {
  name: string;
  count: number;
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface CustomFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'url' | 'phone';
  required?: boolean;
  options?: string[];
}

// -----------------------------------------------------------------------------
// Lists
// -----------------------------------------------------------------------------

export function listEmailLists(opts?: { page?: number; limit?: number; includeArchived?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  if (opts?.includeArchived) qs.set('includeArchived', 'true');
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailListDoc>>(`/v1/email/audience/lists${tail}`);
}

export function createEmailList(body: {
  name: string;
  description?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
}) {
  return rustFetch<EmailListDoc>('/v1/email/audience/lists', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEmailList(id: string) {
  return rustFetch<EmailListDoc>(`/v1/email/audience/lists/${id}`);
}

export function updateEmailList(id: string, body: Partial<Omit<EmailListDoc, '_id' | 'userId' | 'createdAt' | 'updatedAt' | 'subscriberCount'>>) {
  return rustFetch<EmailListDoc>(`/v1/email/audience/lists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function archiveEmailList(id: string) {
  return rustFetch<void>(`/v1/email/audience/lists/${id}`, { method: 'DELETE' });
}

// -----------------------------------------------------------------------------
// Subscribers
// -----------------------------------------------------------------------------

export function listEmailSubscribers(opts?: {
  page?: number;
  limit?: number;
  listId?: string;
  status?: EmailSubscriberStatus;
  search?: string;
  tag?: string;
}) {
  const qs = new URLSearchParams();
  if (opts?.page)   qs.set('page', String(opts.page));
  if (opts?.limit)  qs.set('limit', String(opts.limit));
  if (opts?.listId) qs.set('listId', opts.listId);
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.search) qs.set('search', opts.search);
  if (opts?.tag)    qs.set('tag', opts.tag);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailSubscriberDoc>>(`/v1/email/audience/subscribers${tail}`);
}

export function createEmailSubscriber(body: {
  listId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status?: EmailSubscriberStatus;
}) {
  return rustFetch<EmailSubscriberDoc>('/v1/email/audience/subscribers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEmailSubscriber(id: string) {
  return rustFetch<EmailSubscriberDoc>(`/v1/email/audience/subscribers/${id}`);
}

export function updateEmailSubscriber(id: string, body: {
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  status?: EmailSubscriberStatus;
}) {
  return rustFetch<EmailSubscriberDoc>(`/v1/email/audience/subscribers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function archiveEmailSubscriber(id: string) {
  return rustFetch<void>(`/v1/email/audience/subscribers/${id}`, { method: 'DELETE' });
}

// -----------------------------------------------------------------------------
// Segments
// -----------------------------------------------------------------------------

export function listEmailSegments() {
  return rustFetch<EmailSegmentDoc[]>('/v1/email/audience/segments');
}

export function createEmailSegment(body: {
  name: string;
  description?: string;
  listId?: string;
  filter: EmailFilterTree;
}) {
  return rustFetch<EmailSegmentDoc>('/v1/email/audience/segments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEmailSegment(id: string) {
  return rustFetch<EmailSegmentDoc>(`/v1/email/audience/segments/${id}`);
}

export function updateEmailSegment(id: string, body: {
  name?: string;
  description?: string;
  filter?: EmailFilterTree;
}) {
  return rustFetch<EmailSegmentDoc>(`/v1/email/audience/segments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEmailSegment(id: string) {
  return rustFetch<void>(`/v1/email/audience/segments/${id}`, { method: 'DELETE' });
}

export function previewEmailSegment(body: {
  filter: EmailFilterTree;
  listId?: string;
  sampleSize?: number;
}) {
  return rustFetch<SegmentPreview>('/v1/email/audience/segments/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function recountEmailSegment(id: string) {
  return rustFetch<{ id: string; matches: number }>(`/v1/email/audience/segments/${id}/recount`, {
    method: 'POST',
  });
}

// -----------------------------------------------------------------------------
// Tags + Custom fields
// -----------------------------------------------------------------------------

export function listEmailTags() {
  return rustFetch<{ tags: TagWithCount[] }>('/v1/email/audience/tags');
}

export function getEmailFieldSchema() {
  return rustFetch<{ fields: CustomFieldDef[] }>('/v1/email/audience/fields');
}

export function putEmailFieldSchema(fields: CustomFieldDef[]) {
  return rustFetch<{ fields: CustomFieldDef[] }>('/v1/email/audience/fields', {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
}
