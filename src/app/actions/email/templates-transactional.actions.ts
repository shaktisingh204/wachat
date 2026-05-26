'use server';

import { revalidatePath } from 'next/cache';

import {
  createTransactionalTemplate,
  deleteTransactionalTemplate,
  getTransactionalTemplate,
  listTransactionalTemplates,
  previewTransactionalTemplate,
  testSendTransactionalTemplate,
  updateTransactionalTemplate,
  type CreateTransactionalTemplateInput,
  type PageResponse,
  type TransactionalPreviewResponse,
  type TransactionalTemplateDoc,
} from '@/lib/rust-client/email-templates-transactional';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
const failure = (e: unknown): ActionResult<never> => ({
  ok: false,
  error: (e as Error)?.message ?? 'Unknown',
});

const ROUTE = '/dashboard/email/templates/transactional';

export async function actionListTransactionalTemplates(opts?: {
  page?: number;
  limit?: number;
  q?: string;
  archived?: boolean;
}): Promise<ActionResult<PageResponse<TransactionalTemplateDoc>>> {
  try {
    return { ok: true, data: await listTransactionalTemplates(opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetTransactionalTemplate(
  id: string,
): Promise<ActionResult<TransactionalTemplateDoc>> {
  try {
    return { ok: true, data: await getTransactionalTemplate(id) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateTransactionalTemplate(
  body: CreateTransactionalTemplateInput,
): Promise<ActionResult<TransactionalTemplateDoc>> {
  try {
    const data = await createTransactionalTemplate(body);
    revalidatePath(ROUTE);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateTransactionalTemplate(
  id: string,
  patch: Partial<CreateTransactionalTemplateInput> & { archived?: boolean },
): Promise<ActionResult<TransactionalTemplateDoc>> {
  try {
    const data = await updateTransactionalTemplate(id, patch);
    revalidatePath(ROUTE);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionDeleteTransactionalTemplate(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await deleteTransactionalTemplate(id);
    revalidatePath(ROUTE);
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

export async function actionPreviewTransactionalTemplate(
  id: string,
  vars: Record<string, unknown>,
): Promise<ActionResult<TransactionalPreviewResponse>> {
  try {
    return { ok: true, data: await previewTransactionalTemplate(id, vars) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionTestSendTransactionalTemplate(
  id: string,
  toEmails: string[],
  vars: Record<string, unknown> = {},
): Promise<ActionResult<{ queued: number; note?: string }>> {
  try {
    return { ok: true, data: await testSendTransactionalTemplate(id, toEmails, vars) };
  } catch (e) {
    return failure(e);
  }
}
