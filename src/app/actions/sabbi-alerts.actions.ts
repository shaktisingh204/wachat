'use server';

/**
 * SabBI alert actions. "Check now" evaluates every active alert for the active
 * project against its threshold and fires (email + SabFlow webhook) on a cross.
 * The same per-alert logic is what a Vercel Cron / worker would call on a
 * schedule (iterating projects with `runWithRustTenantAs`).
 */

import { revalidatePath } from 'next/cache';

import { getCachedSession } from '@/lib/server-cache';
import {
  createAlert,
  deleteAlert,
  evaluate,
  fireAlert,
  listAlerts,
  recordCheck,
  setAlertStatus,
  type AlertCondition,
  type SabbiAlert,
} from '@/lib/sabbi/alerts.server';

import { runMetricQueryAction } from './sabbi-models.actions';

const PATH = '/dashboard/sabbi/alerts';

export async function listAlertsAction(): Promise<SabbiAlert[]> {
  return listAlerts();
}

export async function createAlertAction(input: {
  name: string;
  modelId: string;
  measure: string;
  condition: AlertCondition;
  threshold: number;
  recipients?: string[];
  webhookUrl?: string;
}) {
  const res = await createAlert(input);
  revalidatePath(PATH);
  return res;
}

export async function deleteAlertAction(id: string) {
  await deleteAlert(id);
  revalidatePath(PATH);
}

export async function setAlertStatusAction(id: string, status: 'active' | 'paused') {
  await setAlertStatus(id, status);
  revalidatePath(PATH);
}

export interface AlertCheck {
  id: string;
  name: string;
  value?: number;
  triggered?: boolean;
  error?: string;
}

export async function checkAlertsAction(): Promise<AlertCheck[]> {
  const alerts = (await listAlerts()).filter((a) => a.status === 'active');
  const session = await getCachedSession();
  const tenantUserId = String((session?.user as { _id?: unknown } | undefined)?._id ?? '');

  const out: AlertCheck[] = [];
  for (const a of alerts) {
    try {
      const res = await runMetricQueryAction({
        modelId: a.modelId,
        measures: [a.measure],
        dimensions: [],
        chartType: 'kpi',
        limit: 1,
      });
      const value = (res.rows as Record<string, unknown>[]).reduce((s, r) => {
        const v = r[a.measure];
        return s + (typeof v === 'number' ? v : Number(v) || 0);
      }, 0);
      const triggered = evaluate(a.condition, value, a.threshold);
      if (triggered) await fireAlert(a, value, tenantUserId);
      await recordCheck(a._id, value, triggered);
      out.push({ id: a._id, name: a.name, value, triggered });
    } catch (e) {
      out.push({ id: a._id, name: a.name, error: e instanceof Error ? e.message : 'check failed' });
    }
  }
  revalidatePath(PATH);
  return out;
}
