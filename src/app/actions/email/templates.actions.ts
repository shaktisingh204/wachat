'use server';

/**
 * Email Suite — Templates server actions.
 *
 * Thin wrappers around the `email-templates` Rust client. Each wrapper
 * normalizes errors into a discriminated `ActionResult<T>` shape so
 * client components can render failures inline without try/catch.
 */

import { revalidatePath } from 'next/cache';

import {
  createEmailTemplate,
  deleteEmailTemplate,
  getEmailTemplate,
  listEmailTemplates,
  listLibraryTemplates,
  renderEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateDoc,
  type PageResponse,
  type RenderResult,
} from '@/lib/rust-client/email-templates';
import type { EmailBuilderDocument } from '@/lib/email/types';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

export async function actionListEmailTemplates(opts?: {
  page?: number;
  limit?: number;
  category?: string;
}): Promise<ActionResult<PageResponse<EmailTemplateDoc>>> {
  try {
    return { ok: true, data: await listEmailTemplates(opts) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCreateEmailTemplate(input: {
  name: string;
  subject?: string;
  category?: string;
  builderJson?: EmailBuilderDocument;
  mjml?: string;
}): Promise<ActionResult<EmailTemplateDoc>> {
  try {
    const data = await createEmailTemplate(input);
    revalidatePath('/dashboard/email/templates');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetEmailTemplate(id: string): Promise<ActionResult<EmailTemplateDoc>> {
  try {
    return { ok: true, data: await getEmailTemplate(id) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateEmailTemplate(
  id: string,
  patch: Partial<EmailTemplateDoc>,
): Promise<ActionResult<EmailTemplateDoc>> {
  try {
    const data = await updateEmailTemplate(id, patch);
    revalidatePath('/dashboard/email/templates');
    revalidatePath(`/dashboard/email/templates/${id}/builder`);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionDeleteEmailTemplate(id: string): Promise<ActionResult<null>> {
  try {
    await deleteEmailTemplate(id);
    revalidatePath('/dashboard/email/templates');
    return { ok: true, data: null };
  } catch (e) {
    return failure(e);
  }
}

export async function actionRenderEmailTemplate(id: string): Promise<ActionResult<RenderResult>> {
  try {
    return { ok: true, data: await renderEmailTemplate(id) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionListLibraryEmailTemplates(): Promise<ActionResult<EmailTemplateDoc[]>> {
  try {
    return { ok: true, data: await listLibraryTemplates() };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Fork a curated library template into the user's own templates collection.
 * Reads the source, then creates a fresh user-scoped copy.
 */
export async function actionForkLibraryTemplate(
  sourceId: string,
  overrides?: { name?: string },
): Promise<ActionResult<EmailTemplateDoc>> {
  try {
    const src = await getEmailTemplate(sourceId);
    const data = await createEmailTemplate({
      name: overrides?.name ?? `${src.name} (copy)`,
      subject: src.subject,
      category: src.category,
      builderJson: src.builderJson,
      mjml: src.mjml,
    });
    revalidatePath('/dashboard/email/templates');
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// Types intentionally NOT re-exported from this file.
// Server-action files ('use server') can only have async-function exports
// at runtime; even `export type { … }` gets emitted into the generated
// actions shim and fails the build. Import types directly from
// `@/lib/rust-client/email-templates` instead.
