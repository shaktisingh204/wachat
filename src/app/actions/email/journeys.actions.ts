'use server';

import { revalidatePath } from 'next/cache';

import {
  activateEmailJourney,
  cloneEmailJourney,
  createEmailJourney,
  deleteEmailJourney,
  enrollEmailJourneySubscriber,
  getEmailJourney,
  getEmailJourneyReport,
  listEmailJourneyRuns,
  listEmailJourneyTemplates,
  listEmailJourneys,
  pauseEmailJourney,
  updateEmailJourney,
  type EmailJourneyDoc,
  type EmailJourneyReport,
  type EmailJourneyRunDoc,
  type EmailJourneyStatus,
  type EmailJourneyTemplate,
  type PageResponse,
} from '@/lib/rust-client/email-journeys';
import type { EmailJourneyTriggerKind } from '@/lib/email/types';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
const failure = (e: unknown) => ({ ok: false as const, error: (e as Error)?.message ?? 'Unknown' });

const JOURNEYS_PATH = '/dashboard/email/journeys';

export async function actionListEmailJourneys(opts?: {
  page?: number;
  limit?: number;
  status?: EmailJourneyStatus;
  triggerKind?: EmailJourneyTriggerKind;
}): Promise<ActionResult<PageResponse<EmailJourneyDoc>>> {
  try { return { ok: true, data: await listEmailJourneys(opts) }; } catch (e) { return failure(e); }
}

export async function actionCreateEmailJourney(
  input: Parameters<typeof createEmailJourney>[0],
): Promise<ActionResult<EmailJourneyDoc>> {
  try {
    const data = await createEmailJourney(input);
    revalidatePath(JOURNEYS_PATH);
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionGetEmailJourney(id: string): Promise<ActionResult<EmailJourneyDoc>> {
  try { return { ok: true, data: await getEmailJourney(id) }; } catch (e) { return failure(e); }
}

export async function actionUpdateEmailJourney(
  id: string,
  patch: Parameters<typeof updateEmailJourney>[1],
): Promise<ActionResult<EmailJourneyDoc>> {
  try {
    const data = await updateEmailJourney(id, patch);
    revalidatePath(JOURNEYS_PATH);
    revalidatePath(`${JOURNEYS_PATH}/${id}`);
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionDeleteEmailJourney(id: string): Promise<ActionResult<null>> {
  try {
    await deleteEmailJourney(id);
    revalidatePath(JOURNEYS_PATH);
    return { ok: true, data: null };
  } catch (e) { return failure(e); }
}

export async function actionActivateEmailJourney(id: string): Promise<ActionResult<EmailJourneyDoc>> {
  try {
    const data = await activateEmailJourney(id);
    revalidatePath(JOURNEYS_PATH);
    revalidatePath(`${JOURNEYS_PATH}/${id}`);
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionPauseEmailJourney(id: string): Promise<ActionResult<EmailJourneyDoc>> {
  try {
    const data = await pauseEmailJourney(id);
    revalidatePath(JOURNEYS_PATH);
    revalidatePath(`${JOURNEYS_PATH}/${id}`);
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionCloneEmailJourney(id: string): Promise<ActionResult<EmailJourneyDoc>> {
  try {
    const data = await cloneEmailJourney(id);
    revalidatePath(JOURNEYS_PATH);
    return { ok: true, data };
  } catch (e) { return failure(e); }
}

export async function actionListEmailJourneyRuns(
  id: string,
  opts?: { page?: number; limit?: number; status?: string },
): Promise<ActionResult<PageResponse<EmailJourneyRunDoc>>> {
  try { return { ok: true, data: await listEmailJourneyRuns(id, opts) }; } catch (e) { return failure(e); }
}

export async function actionGetEmailJourneyReport(id: string): Promise<ActionResult<EmailJourneyReport>> {
  try { return { ok: true, data: await getEmailJourneyReport(id) }; } catch (e) { return failure(e); }
}

export async function actionEnrollEmailJourneySubscriber(
  id: string,
  subscriberId: string,
): Promise<ActionResult<{ message: string }>> {
  try { return { ok: true, data: await enrollEmailJourneySubscriber(id, subscriberId) }; } catch (e) { return failure(e); }
}

export async function actionListEmailJourneyTemplates(): Promise<ActionResult<EmailJourneyTemplate[]>> {
  try { return { ok: true, data: await listEmailJourneyTemplates() }; } catch (e) { return failure(e); }
}
