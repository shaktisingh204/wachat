'use server';

import { revalidatePath } from 'next/cache';

import {
  assignEmailInboxThread,
  bulkUpdateEmailInboxThreads,
  getEmailInboxThread,
  listEmailInboxAssignments,
  listEmailInboxMessages,
  listEmailInboxThreads,
  releaseEmailInboxAssignment,
  sendEmailInboxReply,
  updateEmailInboxThread,
  type BulkThreadAction,
  type EmailInboxAssignmentDoc,
  type EmailInboxMessageDoc,
  type EmailInboxThreadDoc,
  type ListThreadsOpts,
  type MessageListResponse,
  type SendReplyBody,
  type ThreadDetailResponse,
  type ThreadListResponse,
  type UpdateThreadBody,
} from '@/lib/rust-client/email-inbox';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

// -----------------------------------------------------------------------------
// Threads
// -----------------------------------------------------------------------------

export async function actionListEmailInboxThreads(
  opts?: ListThreadsOpts,
): Promise<ActionResult<ThreadListResponse>> {
  try {
    return { ok: true, data: await listEmailInboxThreads(opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetEmailInboxThread(
  id: string,
  opts?: { limit?: number },
): Promise<ActionResult<ThreadDetailResponse>> {
  try {
    return { ok: true, data: await getEmailInboxThread(id, opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionListEmailInboxMessages(
  threadId: string,
  opts?: { page?: number; limit?: number },
): Promise<ActionResult<MessageListResponse>> {
  try {
    return { ok: true, data: await listEmailInboxMessages(threadId, opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailInboxThread(
  id: string,
  patch: UpdateThreadBody,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const data = await updateEmailInboxThread(id, patch);
    revalidatePath('/dashboard/sabmail/inbox');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionBulkUpdateEmailInboxThreads(input: {
  threadIds: string[];
  action: BulkThreadAction;
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const data = await bulkUpdateEmailInboxThreads(input);
    revalidatePath('/dashboard/sabmail/inbox');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Reply / send
// -----------------------------------------------------------------------------

export async function actionSendEmailInboxReply(
  threadId: string,
  body: SendReplyBody,
): Promise<ActionResult<{ messageId: string }>> {
  try {
    const data = await sendEmailInboxReply(threadId, body);
    revalidatePath('/dashboard/sabmail/inbox');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Assignments
// -----------------------------------------------------------------------------

export async function actionAssignEmailInboxThread(
  threadId: string,
  assignedTo: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  try {
    const data = await assignEmailInboxThread(threadId, { assignedTo });
    revalidatePath('/dashboard/sabmail/inbox');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionReleaseEmailInboxAssignment(
  threadId: string,
  assignmentId: string,
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const data = await releaseEmailInboxAssignment(threadId, assignmentId);
    revalidatePath('/dashboard/sabmail/inbox');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionListEmailInboxAssignments(
  threadId: string,
): Promise<ActionResult<{ assignments: EmailInboxAssignmentDoc[] }>> {
  try {
    return { ok: true, data: await listEmailInboxAssignments(threadId) };
  } catch (e) {
    return failure(e);
  }
}

// Re-export for client components.
export type {
  EmailInboxThreadDoc,
  EmailInboxMessageDoc,
  EmailInboxAssignmentDoc,
  ListThreadsOpts,
  SendReplyBody,
  UpdateThreadBody,
  BulkThreadAction,
  ThreadListResponse,
  ThreadDetailResponse,
  MessageListResponse,
};
