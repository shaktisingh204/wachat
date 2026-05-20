/**
 * Slack notifications — incoming-webhook delivery.
 *
 * Reads the tenant-scoped Slack settings from `crm_slack_settings`
 * (matches the existing settings page at
 *  `/dashboard/crm/settings/integrations/slack`). Per the project memory
 * and `WsSlackSetting`, that collection stores `webhook_url`, `channel`,
 * `username`, and an `is_active` flag — we treat `is_active === false`
 * as "disabled" (the brief's `status` field is implemented as
 * `is_active` in this codebase).
 *
 * Failures NEVER bubble up: the calling action (lead/ticket/leave/…)
 * must keep working even if Slack is down or misconfigured. We log to
 * console and record an `integration_events` row (the same collection
 * the integration console reads) so operators can see why a delivery
 * dropped.
 */
import { ObjectId, type Db } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  footer?: string;
  ts?: number;
}

interface SlackSettingDoc {
  _id: ObjectId;
  userId: ObjectId;
  webhook_url?: string;
  channel?: string;
  username?: string;
  is_active?: boolean;
}

interface SendOptions {
  /** Override the tenant id — for system jobs / API callers without a session. */
  userId?: string;
}

interface IntegrationEventLog {
  userId: ObjectId;
  integration: string;
  kind: 'delivery' | 'failure' | 'test';
  status: 'success' | 'failure';
  message: string;
  createdAt: Date;
}

async function logSlackEvent(
  db: Db,
  userId: ObjectId,
  kind: 'delivery' | 'failure',
  status: 'success' | 'failure',
  message: string,
): Promise<void> {
  const doc: IntegrationEventLog = {
    userId,
    integration: 'slack',
    kind,
    status,
    message,
    createdAt: new Date(),
  };
  try {
    await db.collection('integration_events').insertOne(doc);
  } catch (err) {
    console.error('[slack] failed to log integration event:', err);
  }
}

/**
 * Resolve the tenant for the current request. Server-action callers
 * almost always have a session; cron jobs / webhook callers can pass
 * `opts.userId` to override.
 */
async function resolveUserId(opts: SendOptions | undefined): Promise<ObjectId | null> {
  if (opts?.userId && ObjectId.isValid(opts.userId)) {
    return new ObjectId(opts.userId);
  }
  const session = await getSession();
  if (!session?.user?._id) return null;
  const raw = String(session.user._id);
  if (!ObjectId.isValid(raw)) return null;
  return new ObjectId(raw);
}

/**
 * Send a Slack notification for the current tenant. No-ops cleanly if
 * Slack isn't configured or is disabled — callers do not need to
 * try/catch.
 */
export async function sendSlackNotification(
  text: string,
  attachments?: SlackAttachment[],
  opts?: SendOptions,
): Promise<{ delivered: boolean; reason?: string }> {
  try {
    const userId = await resolveUserId(opts);
    if (!userId) {
      return { delivered: false, reason: 'no-tenant' };
    }

    const { db } = await connectToDatabase();
    const setting = (await db
      .collection<SlackSettingDoc>('crm_slack_settings')
      .findOne({ userId })) as SlackSettingDoc | null;

    if (!setting?.webhook_url) {
      return { delivered: false, reason: 'no-webhook' };
    }
    // The brief's `status: 'disabled'` is modelled here as `is_active === false`.
    if (setting.is_active === false) {
      return { delivered: false, reason: 'disabled' };
    }

    const payload: Record<string, unknown> = { text };
    if (setting.channel) payload.channel = setting.channel;
    if (setting.username) payload.username = setting.username;
    if (attachments && attachments.length > 0) payload.attachments = attachments;

    const res = await fetch(setting.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const msg = `Slack webhook ${res.status}: ${body.slice(0, 200)}`;
      console.error('[slack]', msg);
      await logSlackEvent(db, userId, 'failure', 'failure', msg);
      return { delivered: false, reason: 'webhook-error' };
    }

    await logSlackEvent(
      db,
      userId,
      'delivery',
      'success',
      text.slice(0, 280),
    );
    return { delivered: true };
  } catch (err) {
    // Log but never throw — callers expect this to be fire-and-forget.
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[slack] notification failed:', msg);
    return { delivered: false, reason: 'exception' };
  }
}
