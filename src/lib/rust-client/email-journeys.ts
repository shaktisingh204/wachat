/**
 * Email Suite — Journeys Rust client.
 *
 * Thin typed wrappers around the `/v1/email/journeys/*` endpoints exposed by
 * the `email-journeys` Rust crate. All calls go through `rustFetch`.
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type {
  EmailJourneyEdge,
  EmailJourneyNode,
  EmailJourneyTriggerKind,
} from '@/lib/email/types';

export type EmailJourneyStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface EmailJourneyDoc {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  status: EmailJourneyStatus;
  nodes: EmailJourneyNode[];
  edges: EmailJourneyEdge[];
  trigger: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
  reentryPolicy: 'never' | 'after_exit' | 'always';
  stats?: { entered: number; active: number; completed: number; goalReached: number };
  createdAt: string;
  updatedAt: string;
}

export interface EmailJourneyRunDoc {
  _id: string;
  userId: string;
  journeyId: string;
  subscriberId: string;
  currentNodeId: string;
  status: 'active' | 'waiting' | 'completed' | 'exited' | 'errored';
  nextStepAt?: string;
  enteredAt: string;
  completedAt?: string;
}

export interface EmailJourneyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
  nodes: EmailJourneyNode[];
  edges: EmailJourneyEdge[];
}

export interface EmailJourneyReport {
  entered: number;
  active: number;
  waiting: number;
  completed: number;
  exited: number;
  errored: number;
  perNode: Record<string, { count?: number; trueCount?: number; falseCount?: number }>;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// -----------------------------------------------------------------------------
// CRUD + lifecycle
// -----------------------------------------------------------------------------

export function listEmailJourneys(opts?: {
  page?: number;
  limit?: number;
  status?: EmailJourneyStatus;
  triggerKind?: EmailJourneyTriggerKind;
}) {
  const qs = new URLSearchParams();
  if (opts?.page)        qs.set('page', String(opts.page));
  if (opts?.limit)       qs.set('limit', String(opts.limit));
  if (opts?.status)      qs.set('status', opts.status);
  if (opts?.triggerKind) qs.set('triggerKind', opts.triggerKind);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailJourneyDoc>>(`/v1/email/journeys/${tail}`);
}

export function createEmailJourney(body: {
  name: string;
  description?: string;
  nodes?: EmailJourneyNode[];
  edges?: EmailJourneyEdge[];
  trigger?: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
}) {
  return rustFetch<EmailJourneyDoc>('/v1/email/journeys/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEmailJourney(id: string) {
  return rustFetch<EmailJourneyDoc>(`/v1/email/journeys/${id}`);
}

export function updateEmailJourney(
  id: string,
  body: {
    name?: string;
    description?: string;
    nodes?: EmailJourneyNode[];
    edges?: EmailJourneyEdge[];
    trigger?: { kind: EmailJourneyTriggerKind; config?: Record<string, unknown> };
  },
) {
  return rustFetch<EmailJourneyDoc>(`/v1/email/journeys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteEmailJourney(id: string) {
  return rustFetch<void>(`/v1/email/journeys/${id}`, { method: 'DELETE' });
}

export function activateEmailJourney(id: string) {
  return rustFetch<EmailJourneyDoc>(`/v1/email/journeys/${id}/activate`, { method: 'POST' });
}

export function pauseEmailJourney(id: string) {
  return rustFetch<EmailJourneyDoc>(`/v1/email/journeys/${id}/pause`, { method: 'POST' });
}

export function cloneEmailJourney(id: string) {
  return rustFetch<EmailJourneyDoc>(`/v1/email/journeys/${id}/clone`, { method: 'POST' });
}

export function listEmailJourneyRuns(id: string, opts?: { page?: number; limit?: number; status?: string }) {
  const qs = new URLSearchParams();
  if (opts?.page)   qs.set('page', String(opts.page));
  if (opts?.limit)  qs.set('limit', String(opts.limit));
  if (opts?.status) qs.set('status', opts.status);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<PageResponse<EmailJourneyRunDoc>>(`/v1/email/journeys/${id}/runs${tail}`);
}

export function getEmailJourneyReport(id: string) {
  return rustFetch<EmailJourneyReport>(`/v1/email/journeys/${id}/report`);
}

export function enrollEmailJourneySubscriber(id: string, subscriberId: string) {
  return rustFetch<{ message: string }>(`/v1/email/journeys/${id}/enroll`, {
    method: 'POST',
    body: JSON.stringify({ subscriberId }),
  });
}

export function listEmailJourneyTemplates() {
  return rustFetch<EmailJourneyTemplate[]>('/v1/email/journeys/templates');
}
