'use server';

import { revalidatePath } from 'next/cache';

import {
  createEmailApiKey,
  listEmailApiKeys,
  revokeEmailApiKey,
  updateEmailApiKey,
  type EmailApiKeyCreateResult,
  type EmailApiKeyDoc,
  type EmailApiKeyScope,
} from '@/lib/rust-client/email-api-keys';
import {
  createEmailWebhook,
  deleteEmailWebhook,
  listEmailWebhooks,
  testEmailWebhook,
  updateEmailWebhook,
  type EmailWebhookDoc,
  type EmailWebhookEvent,
  type EmailWebhookTestResult,
} from '@/lib/rust-client/email-webhooks';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

const PATH = '/dashboard/email/integrations';

// -----------------------------------------------------------------------------
// API Keys
// -----------------------------------------------------------------------------

export async function actionListEmailApiKeys(): Promise<ActionResult<EmailApiKeyDoc[]>> {
  try {
    const res = await listEmailApiKeys();
    return { ok: true, data: res.items };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailApiKey(input: {
  name: string;
  scopes: EmailApiKeyScope[];
}): Promise<ActionResult<EmailApiKeyCreateResult>> {
  try {
    const data = await createEmailApiKey(input);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailApiKey(
  id: string,
  patch: { name?: string; scopes?: EmailApiKeyScope[] },
): Promise<ActionResult<EmailApiKeyDoc>> {
  try {
    const data = await updateEmailApiKey(id, patch);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionRevokeEmailApiKey(id: string): Promise<ActionResult<null>> {
  try {
    await revokeEmailApiKey(id);
    revalidatePath(PATH);
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------

export async function actionListEmailWebhooks(): Promise<ActionResult<EmailWebhookDoc[]>> {
  try {
    const res = await listEmailWebhooks();
    return { ok: true, data: res.items };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailWebhook(input: {
  name?: string;
  url: string;
  events: EmailWebhookEvent[];
  active?: boolean;
}): Promise<ActionResult<EmailWebhookDoc>> {
  try {
    const data = await createEmailWebhook(input);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailWebhook(
  id: string,
  patch: {
    name?: string;
    url?: string;
    events?: EmailWebhookEvent[];
    active?: boolean;
  },
): Promise<ActionResult<EmailWebhookDoc>> {
  try {
    const data = await updateEmailWebhook(id, patch);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionDeleteEmailWebhook(id: string): Promise<ActionResult<null>> {
  try {
    await deleteEmailWebhook(id);
    revalidatePath(PATH);
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

export async function actionTestEmailWebhook(id: string): Promise<ActionResult<EmailWebhookTestResult>> {
  try {
    return { ok: true, data: await testEmailWebhook(id) };
  } catch (e) {
    return failure(e);
  }
}

