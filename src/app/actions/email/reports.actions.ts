'use server';

import {
  compareCampaigns,
  getAccountReport,
  getCampaignReport,
  getJourneyReport,
  getRevenueReport,
  type EmailAccountReport,
  type EmailCampaignReport,
  type EmailCompareRow,
  type EmailJourneyReport,
  type EmailRevenueReport,
} from '@/lib/rust-client/email-reports';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: (e as Error)?.message ?? 'Unknown error' };
}

export async function actionGetCampaignReport(
  id: string,
): Promise<ActionResult<EmailCampaignReport>> {
  try {
    return { ok: true, data: await getCampaignReport(id) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetJourneyReport(
  id: string,
): Promise<ActionResult<EmailJourneyReport>> {
  try {
    return { ok: true, data: await getJourneyReport(id) };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetAccountReport(): Promise<ActionResult<EmailAccountReport>> {
  try {
    return { ok: true, data: await getAccountReport() };
  } catch (e) {
    return failure(e);
  }
}

export async function actionCompareCampaigns(
  campaignIds: string[],
): Promise<ActionResult<EmailCompareRow[]>> {
  try {
    const res = await compareCampaigns(campaignIds);
    return { ok: true, data: res.rows };
  } catch (e) {
    return failure(e);
  }
}

export async function actionGetRevenueReport(): Promise<ActionResult<EmailRevenueReport>> {
  try {
    return { ok: true, data: await getRevenueReport() };
  } catch (e) {
    return failure(e);
  }
}

