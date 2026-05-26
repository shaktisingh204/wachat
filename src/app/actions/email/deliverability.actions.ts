'use server';

import { revalidatePath } from 'next/cache';

import {
  checkEmailDomain,
  generateDkim,
  getDeliverabilityScore,
  getLatestPlacementTest,
  listEmailDomains,
  listWarmupRuns,
  rotateDkim,
  runPlacementTest,
  startWarmupRun,
  updateWarmupRun,
  type DeliverabilityScore,
  type DkimGenerateResult,
  type EmailDomainDoc,
  type PlacementTestDoc,
  type WarmupDayPlan,
  type WarmupRunDoc,
} from '@/lib/rust-client/email-deliverability';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

const PATH = '/dashboard/email/deliverability';

// -----------------------------------------------------------------------------
// Domains
// -----------------------------------------------------------------------------

export async function actionListEmailDomains(): Promise<ActionResult<EmailDomainDoc[]>> {
  try {
    const res = await listEmailDomains();
    return { ok: true, data: res.items };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCheckEmailDomain(
  domain: string,
): Promise<ActionResult<EmailDomainDoc>> {
  try {
    const data = await checkEmailDomain(domain);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGenerateDkim(
  domain: string,
): Promise<ActionResult<DkimGenerateResult>> {
  try {
    const data = await generateDkim(domain);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionRotateDkim(
  domain: string,
): Promise<ActionResult<DkimGenerateResult>> {
  try {
    const data = await rotateDkim(domain);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Warmup
// -----------------------------------------------------------------------------

export async function actionListWarmupRuns(): Promise<ActionResult<WarmupRunDoc[]>> {
  try {
    const res = await listWarmupRuns();
    return { ok: true, data: res.items };
  } catch (e) {
    return failure(e);
  }
}

export async function actionStartWarmupRun(input: {
  domain: string;
  schedule: WarmupDayPlan[];
}): Promise<ActionResult<WarmupRunDoc>> {
  try {
    const data = await startWarmupRun(input);
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

export async function actionUpdateWarmupRun(
  id: string,
  action: 'pause' | 'resume' | 'cancel',
): Promise<ActionResult<WarmupRunDoc>> {
  try {
    const data = await updateWarmupRun(id, { action });
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Placement
// -----------------------------------------------------------------------------

export async function actionGetLatestPlacementTest(): Promise<ActionResult<PlacementTestDoc | null>> {
  try {
    return { ok: true, data: await getLatestPlacementTest() };
  } catch (e) {
    return failure(e);
  }
}

export async function actionRunPlacementTest(): Promise<ActionResult<PlacementTestDoc>> {
  try {
    const data = await runPlacementTest();
    revalidatePath(PATH);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}

// -----------------------------------------------------------------------------
// Score
// -----------------------------------------------------------------------------

export async function actionGetDeliverabilityScore(): Promise<ActionResult<DeliverabilityScore>> {
  try {
    return { ok: true, data: await getDeliverabilityScore() };
  } catch (e) {
    return failure(e);
  }
}

