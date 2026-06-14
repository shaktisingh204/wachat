import 'server-only';

/**
 * SabBI alerts — threshold checks on a model's measure, delivered to channels
 * and emitted as a trigger into SabFlow.
 *
 * Alerts are SabBI's own data (`sabbi_alerts`, project-scoped). Evaluation runs
 * a KPI MetricQuery for the measure and compares the aggregate to a threshold.
 * On fire: an email via the platform transport (`dispatchTransactionalEmail`)
 * and an optional POST to a SabFlow webhook-trigger URL — so one alert can drive
 * unlimited downstream automation. The scheduled checker (Vercel Cron / worker)
 * calls {@link evaluate}/{@link fireAlert} per project; the in-app "Check now"
 * uses the session path.
 */
import { ObjectId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';

import { getSabbiWorkspaceId } from './workspace';

export type AlertCondition = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';

export interface SabbiAlert {
  _id: string;
  projectId: string;
  name: string;
  modelId: string;
  measure: string;
  condition: AlertCondition;
  threshold: number;
  recipients: string[];
  /** Optional SabFlow webhook-trigger URL fired with the alert payload. */
  webhookUrl?: string;
  status: 'active' | 'paused';
  lastValue?: number;
  lastTriggeredAt?: string;
  lastCheckedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const COLL = 'sabbi_alerts';

async function scope() {
  const projectId = await getSabbiWorkspaceId();
  if (!projectId) throw new Error('No active SabBI workspace');
  const { db } = await connectToDatabase();
  return { db, projectId };
}

function serialize(d: Document): SabbiAlert {
  return {
    _id: String(d._id),
    projectId: String(d.projectId),
    name: d.name,
    modelId: String(d.modelId),
    measure: d.measure,
    condition: d.condition,
    threshold: Number(d.threshold),
    recipients: Array.isArray(d.recipients) ? d.recipients : [],
    webhookUrl: d.webhookUrl ?? undefined,
    status: d.status === 'paused' ? 'paused' : 'active',
    lastValue: typeof d.lastValue === 'number' ? d.lastValue : undefined,
    lastTriggeredAt: d.lastTriggeredAt instanceof Date ? d.lastTriggeredAt.toISOString() : d.lastTriggeredAt,
    lastCheckedAt: d.lastCheckedAt instanceof Date ? d.lastCheckedAt.toISOString() : d.lastCheckedAt,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

export async function listAlerts(): Promise<SabbiAlert[]> {
  const { db, projectId } = await scope();
  const rows = await db.collection(COLL).find({ projectId }).sort({ createdAt: -1 }).limit(200).toArray();
  return rows.map(serialize);
}

export async function createAlert(input: {
  name: string;
  modelId: string;
  measure: string;
  condition: AlertCondition;
  threshold: number;
  recipients?: string[];
  webhookUrl?: string;
}): Promise<{ id: string }> {
  const { db, projectId } = await scope();
  const now = new Date();
  const res = await db.collection(COLL).insertOne({
    projectId,
    name: input.name.trim() || 'Untitled alert',
    modelId: input.modelId,
    measure: input.measure,
    condition: input.condition,
    threshold: Number(input.threshold),
    recipients: (input.recipients ?? []).map((r) => r.trim()).filter(Boolean),
    webhookUrl: input.webhookUrl?.trim() || undefined,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(res.insertedId) };
}

export async function setAlertStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const { db, projectId } = await scope();
  await db.collection(COLL).updateOne({ _id: new ObjectId(id), projectId }, { $set: { status, updatedAt: new Date() } });
}

export async function deleteAlert(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const { db, projectId } = await scope();
  await db.collection(COLL).deleteOne({ _id: new ObjectId(id), projectId });
}

/** Record the outcome of a check (value + whether it fired). */
export async function recordCheck(id: string, value: number, triggered: boolean): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const { db, projectId } = await scope();
  const set: Document = { lastValue: value, lastCheckedAt: new Date(), updatedAt: new Date() };
  if (triggered) set.lastTriggeredAt = new Date();
  await db.collection(COLL).updateOne({ _id: new ObjectId(id), projectId }, { $set: set });
}

/** Pure threshold test. */
export function evaluate(condition: AlertCondition, value: number, threshold: number): boolean {
  switch (condition) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'ne': return value !== threshold;
    default: return false;
  }
}

/**
 * Deliver a fired alert: email recipients (via the tenant transport) and POST
 * the payload to the SabFlow webhook-trigger URL if configured. Never throws —
 * a delivery failure must not abort the check loop.
 */
export async function fireAlert(alert: SabbiAlert, value: number, tenantUserId: string): Promise<void> {
  const subject = `SabBI alert: ${alert.name}`;
  const body =
    `${alert.name}\n\n${alert.measure} = ${value} ` +
    `(condition: ${alert.condition} ${alert.threshold}).\n\nSent by SabBI.`;

  if (alert.recipients.length > 0 && tenantUserId) {
    try {
      await dispatchTransactionalEmail({
        tenantUserId,
        to: alert.recipients,
        subject,
        body,
        templateId: 'sabbi-alert',
      });
    } catch {
      /* delivery failure is non-fatal */
    }
  }

  if (alert.webhookUrl) {
    try {
      await fetch(alert.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'sabbi.alert',
          alert: alert.name,
          measure: alert.measure,
          value,
          condition: alert.condition,
          threshold: alert.threshold,
          firedAt: new Date().toISOString(),
        }),
      });
    } catch {
      /* webhook failure is non-fatal */
    }
  }
}
