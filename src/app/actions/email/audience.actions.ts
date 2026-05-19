'use server';

import { revalidatePath } from 'next/cache';

import {
  archiveEmailList,
  createEmailList,
  createEmailSegment,
  createEmailSubscriber,
  deleteEmailSegment,
  getEmailFieldSchema,
  listEmailLists,
  listEmailSegments,
  listEmailSubscribers,
  listEmailTags,
  previewEmailSegment,
  putEmailFieldSchema,
  recountEmailSegment,
  updateEmailList,
  updateEmailSegment,
  updateEmailSubscriber,
  type CustomFieldDef,
  type EmailListDoc,
  type EmailSegmentDoc,
  type EmailSubscriberDoc,
  type ImportSummary,
  type PageResponse,
  type SegmentPreview,
  type TagWithCount,
} from '@/lib/rust-client/email-audience';
import type { EmailFilterTree } from '@/lib/email/types';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

// -----------------------------------------------------------------------------
// Lists
// -----------------------------------------------------------------------------

export async function actionListEmailLists(opts?: {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}): Promise<ActionResult<PageResponse<EmailListDoc>>> {
  try {
    return { ok: true, data: await listEmailLists(opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailList(input: {
  name: string;
  description?: string;
  defaultFromName?: string;
  defaultFromEmail?: string;
}): Promise<ActionResult<EmailListDoc>> {
  try {
    const data = await createEmailList(input);
    revalidatePath('/dashboard/email/audience/lists');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailList(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    defaultFromName: string;
    defaultFromEmail: string;
  }>,
): Promise<ActionResult<EmailListDoc>> {
  try {
    const data = await updateEmailList(id, patch);
    revalidatePath(`/dashboard/email/audience/lists`);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionArchiveEmailList(id: string): Promise<ActionResult<null>> {
  try {
    await archiveEmailList(id);
    revalidatePath('/dashboard/email/audience/lists');
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Subscribers
// -----------------------------------------------------------------------------

export async function actionListEmailSubscribers(opts?: {
  page?: number;
  limit?: number;
  listId?: string;
  status?: EmailSubscriberDoc['status'];
  search?: string;
  tag?: string;
}): Promise<ActionResult<PageResponse<EmailSubscriberDoc>>> {
  try {
    return { ok: true, data: await listEmailSubscribers(opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailSubscriber(input: {
  listId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}): Promise<ActionResult<EmailSubscriberDoc>> {
  try {
    const data = await createEmailSubscriber(input);
    revalidatePath('/dashboard/email/audience');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailSubscriber(
  id: string,
  patch: Parameters<typeof updateEmailSubscriber>[1],
): Promise<ActionResult<EmailSubscriberDoc>> {
  try {
    const data = await updateEmailSubscriber(id, patch);
    revalidatePath('/dashboard/email/audience');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Segments
// -----------------------------------------------------------------------------

export async function actionListEmailSegments(): Promise<ActionResult<EmailSegmentDoc[]>> {
  try {
    return { ok: true, data: await listEmailSegments() };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailSegment(input: {
  name: string;
  description?: string;
  listId?: string;
  filter: EmailFilterTree;
}): Promise<ActionResult<EmailSegmentDoc>> {
  try {
    const data = await createEmailSegment(input);
    revalidatePath('/dashboard/email/audience/segments');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailSegment(
  id: string,
  patch: { name?: string; description?: string; filter?: EmailFilterTree },
): Promise<ActionResult<EmailSegmentDoc>> {
  try {
    const data = await updateEmailSegment(id, patch);
    revalidatePath('/dashboard/email/audience/segments');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionDeleteEmailSegment(id: string): Promise<ActionResult<null>> {
  try {
    await deleteEmailSegment(id);
    revalidatePath('/dashboard/email/audience/segments');
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

export async function actionPreviewEmailSegment(input: {
  filter: EmailFilterTree;
  listId?: string;
  sampleSize?: number;
}): Promise<ActionResult<SegmentPreview>> {
  try {
    return { ok: true, data: await previewEmailSegment(input) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionRecountEmailSegment(
  id: string,
): Promise<ActionResult<{ id: string; matches: number }>> {
  try {
    return { ok: true, data: await recountEmailSegment(id) };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Tags + Custom fields
// -----------------------------------------------------------------------------

export async function actionListEmailTags(): Promise<ActionResult<{ tags: TagWithCount[] }>> {
  try {
    return { ok: true, data: await listEmailTags() };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetEmailFieldSchema(): Promise<ActionResult<{ fields: CustomFieldDef[] }>> {
  try {
    return { ok: true, data: await getEmailFieldSchema() };
  } catch (e) {
    return failure(e);
  }
}

export async function actionPutEmailFieldSchema(
  fields: CustomFieldDef[],
): Promise<ActionResult<{ fields: CustomFieldDef[] }>> {
  try {
    return { ok: true, data: await putEmailFieldSchema(fields) };
  } catch (e) {
    return failure(e);
  }
}

// Re-export types for client components.
export type {
  EmailListDoc,
  EmailSubscriberDoc,
  EmailSegmentDoc,
  SegmentPreview,
  TagWithCount,
  CustomFieldDef,
  ImportSummary,
  PageResponse,
};
