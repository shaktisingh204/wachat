'use server';

import { revalidatePath } from 'next/cache';

import {
  createEmailCampaign,
  deleteEmailCampaign,
  getEmailCampaign,
  getEmailCampaignReport,
  listEmailCampaigns,
  previewEmailCampaign,
  scheduleEmailCampaign,
  sendEmailCampaign,
  testSendEmailCampaign,
  updateEmailCampaign,
  type EmailCampaignDoc,
  type EmailCampaignStatus,
  type EmailCampaignType,
  type PageResponse,
} from '@/lib/rust-client/email-campaigns';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
const failure = (e: unknown) => ({ ok: false as const, error: (e as Error)?.message ?? 'Unknown' });

export async function actionListEmailCampaigns(opts?: { page?: number; limit?: number; status?: EmailCampaignStatus; type?: EmailCampaignType }): Promise<ActionResult<PageResponse<EmailCampaignDoc>>> {
  try { return { ok: true, data: await listEmailCampaigns(opts) }; } catch (e) { return failure(e); }
}

export async function actionCreateEmailCampaign(input: Parameters<typeof createEmailCampaign>[0]): Promise<ActionResult<EmailCampaignDoc>> {
  try {
    const data = await createEmailCampaign(input);
    revalidatePath('/dashboard/email/campaigns');
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionGetEmailCampaign(id: string): Promise<ActionResult<EmailCampaignDoc>> {
  try { return { ok: true, data: await getEmailCampaign(id) }; } catch (e) { return failure(e); }
}

export async function actionUpdateEmailCampaign(id: string, patch: Partial<EmailCampaignDoc>): Promise<ActionResult<EmailCampaignDoc>> {
  try {
    const data = await updateEmailCampaign(id, patch);
    revalidatePath('/dashboard/email/campaigns');
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionDeleteEmailCampaign(id: string): Promise<ActionResult<null>> {
  try {
    await deleteEmailCampaign(id);
    revalidatePath('/dashboard/email/campaigns');
    return { ok: true, data: null };
  } catch (e) { return failure(e); }
}

export async function actionSendEmailCampaign(id: string) {
  try {
    const data = await sendEmailCampaign(id);
    revalidatePath('/dashboard/email/campaigns');
    return { ok: true as const, data };
  } catch (e) { return failure(e); }
}

export async function actionScheduleEmailCampaign(id: string, scheduledAt: string) {
  try {
    const data = await scheduleEmailCampaign(id, scheduledAt);
    revalidatePath('/dashboard/email/campaigns');
    return { ok: true as const, data };
  } catch (e) { return failure(e); }
}

export async function actionTestSendEmailCampaign(id: string, toEmails: string[]) {
  try {
    return { ok: true as const, data: await testSendEmailCampaign(id, toEmails) };
  } catch (e) { return failure(e); }
}

export async function actionPreviewEmailCampaign(id: string) {
  try { return { ok: true as const, data: await previewEmailCampaign(id) }; } catch (e) { return failure(e); }
}

export async function actionGetEmailCampaignReport(id: string) {
  try { return { ok: true as const, data: await getEmailCampaignReport(id) }; } catch (e) { return failure(e); }
}

export type { EmailCampaignDoc, EmailCampaignStatus, EmailCampaignType };
