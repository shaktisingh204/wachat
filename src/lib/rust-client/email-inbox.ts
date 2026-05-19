/**
 * Email Suite — Inbox Rust client.
 *
 * Thin typed wrappers around the `/v1/email/inbox/*` endpoints exposed by
 * the `email-inbox` Rust crate. All calls go through `rustFetch`, which
 * attaches the authenticated user's JWT.
 *
 * Wire format note: the Rust handlers return Mongo docs run through
 * `document_to_clean_json`, so `_id` / FK fields land as hex strings and
 * `Date` fields land as RFC-3339 strings. The shapes below reflect the
 * wire format, not the in-Rust BSON.
 */
import 'server-only';

import { rustFetch } from './fetcher';

// -----------------------------------------------------------------------------
// Shared shapes
// -----------------------------------------------------------------------------

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export type EmailThreadStatus = 'open' | 'pending' | 'closed' | 'archived';

export interface EmailInboxThreadDoc {
  _id: string;
  userId: string;
  accountId: string;
  subject: string;
  participants: EmailRecipient[];
  status: EmailThreadStatus;
  unread: boolean;
  starred?: boolean;
  labels?: string[];
  campaignId?: string;
  contactId?: string;
  assignedTo?: string | null;
  slaDueAt?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailInboxMessageDoc {
  _id: string;
  userId: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  from: EmailRecipient;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
  sentBy?: string;
  createdAt: string;
}

export interface EmailInboxAssignmentDoc {
  _id: string;
  userId: string;
  threadId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  releasedAt?: string;
}

// -----------------------------------------------------------------------------
// Threads — list / get / messages
// -----------------------------------------------------------------------------

export interface ListThreadsOpts {
  status?: EmailThreadStatus;
  unread?: boolean;
  starred?: boolean;
  assignedTo?: string;
  accountId?: string;
  label?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ThreadListResponse {
  threads: EmailInboxThreadDoc[];
  total: number;
}

export interface ThreadDetailResponse {
  thread: EmailInboxThreadDoc;
  messages: EmailInboxMessageDoc[];
}

export interface MessageListResponse {
  messages: EmailInboxMessageDoc[];
  total: number;
}

export function listEmailInboxThreads(opts?: ListThreadsOpts) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.unread !== undefined) qs.set('unread', String(opts.unread));
  if (opts?.starred !== undefined) qs.set('starred', String(opts.starred));
  if (opts?.assignedTo) qs.set('assignedTo', opts.assignedTo);
  if (opts?.accountId) qs.set('accountId', opts.accountId);
  if (opts?.label) qs.set('label', opts.label);
  if (opts?.q) qs.set('q', opts.q);
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<ThreadListResponse>(`/v1/email/inbox/threads${tail}`);
}

export function getEmailInboxThread(id: string, opts?: { limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<ThreadDetailResponse>(`/v1/email/inbox/threads/${id}${tail}`);
}

export function listEmailInboxMessages(
  threadId: string,
  opts?: { page?: number; limit?: number },
) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const tail = qs.toString() ? `?${qs}` : '';
  return rustFetch<MessageListResponse>(
    `/v1/email/inbox/threads/${threadId}/messages${tail}`,
  );
}

// -----------------------------------------------------------------------------
// Threads — mutations
// -----------------------------------------------------------------------------

export interface UpdateThreadBody {
  status?: EmailThreadStatus;
  unread?: boolean;
  starred?: boolean;
  labels?: string[];
  assignedTo?: string;
  slaDueAt?: string;
}

export function updateEmailInboxThread(id: string, body: UpdateThreadBody) {
  return rustFetch<{ ok: boolean }>(`/v1/email/inbox/threads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type BulkThreadAction =
  | 'archive'
  | 'close'
  | 'reopen'
  | 'mark-read'
  | 'mark-unread'
  | 'star'
  | 'unstar';

export function bulkUpdateEmailInboxThreads(body: {
  threadIds: string[];
  action: BulkThreadAction;
}) {
  return rustFetch<{ updated: number }>(`/v1/email/inbox/threads/bulk`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// -----------------------------------------------------------------------------
// Reply / send
// -----------------------------------------------------------------------------

export interface SendReplyBody {
  subject?: string;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  bodyText?: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
}

export function sendEmailInboxReply(threadId: string, body: SendReplyBody) {
  return rustFetch<{ messageId: string }>(
    `/v1/email/inbox/threads/${threadId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

// -----------------------------------------------------------------------------
// Assignments
// -----------------------------------------------------------------------------

export function assignEmailInboxThread(
  threadId: string,
  body: { assignedTo: string },
) {
  return rustFetch<{ assignmentId: string }>(
    `/v1/email/inbox/threads/${threadId}/assign`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function releaseEmailInboxAssignment(
  threadId: string,
  assignmentId: string,
) {
  return rustFetch<{ ok: boolean }>(
    `/v1/email/inbox/threads/${threadId}/assignments/${assignmentId}`,
    { method: 'DELETE' },
  );
}

export function listEmailInboxAssignments(threadId: string) {
  return rustFetch<{ assignments: EmailInboxAssignmentDoc[] }>(
    `/v1/email/inbox/threads/${threadId}/assignments`,
  );
}
