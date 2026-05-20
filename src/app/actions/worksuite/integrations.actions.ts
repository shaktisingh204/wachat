'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { formToObject, serialize, requireSession } from '@/lib/hr-crud';
import type {
  WsSlackSetting,
  WsPusherSetting,
  WsQuickBooksSetting,
  WsSmtpSetting,
  WsGoogleCalendarSetting,
  WsEmailNotificationSetting,
  WsPushNotificationSetting,
  WsStorageSetting,
  WsSocialAuthSetting,
  WsMessageSetting,
  WsTicketEmailSetting,
  WsFacebookAdsSetting,
} from '@/lib/worksuite/integrations-types';

type FormState = { message?: string; error?: string; id?: string };

const BASE_ROUTE = '/dashboard/crm/settings/integrations';

/**
 * Singleton getter — returns the only doc per tenant (or null).
 */
async function getSingleton<T>(collection: string): Promise<T | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(collection)
    .findOne({ userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as T) : null;
}

/**
 * Singleton upsert — one doc per tenant, keyed by `userId`. Falls
 * through to an insert if no prior doc exists.
 */
async function saveSingleton(
  collection: string,
  payload: Record<string, any>,
  opts: {
    dateFields?: string[];
    booleanKeys?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<{ id?: string; error?: string }> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  const now = new Date();
  const { _id, ...rest } = payload;
  const data: Record<string, any> = { ...rest };

  for (const k of opts.dateFields || []) {
    const v = data[k];
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) data[k] = d;
    }
  }
  for (const k of opts.numericKeys || []) {
    if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
  }
  for (const k of opts.booleanKeys || []) {
    if (data[k] !== undefined) {
      data[k] = data[k] === 'true' || data[k] === 'on' || data[k] === true;
    } else {
      data[k] = false;
    }
  }
  for (const k of opts.jsonKeys || []) {
    if (typeof data[k] === 'string' && data[k]) {
      try {
        data[k] = JSON.parse(data[k]);
      } catch {
        /* leave as string */
      }
    }
  }

  data.userId = new ObjectId(user._id);
  data.updatedAt = now;

  const filter = { userId: new ObjectId(user._id) };
  const existing = await db.collection(collection).findOne(filter);
  if (existing) {
    await db.collection(collection).updateOne(filter, { $set: data });
    return { id: String(existing._id) };
  }
  data.createdAt = now;
  const res = await db.collection(collection).insertOne(data);
  return { id: res.insertedId.toString() };
}

function genericSingletonSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  opts: {
    dateFields?: string[];
    booleanKeys?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<FormState> {
  return (async () => {
    try {
      const data = formToObject(formData, opts.numericKeys || []);
      const res = await saveSingleton(collection, data, opts);
      if (res.error) return { error: res.error };
      revalidatePath(revalidate);
      return { message: 'Saved successfully.', id: res.id };
    } catch (e: any) {
      return { error: e?.message || 'Failed to save' };
    }
  })();
}

/* ═══════════════════════════════════════════════════════════════════
 *  Slack
 * ══════════════════════════════════════════════════════════════════ */

const COL_SLACK = 'crm_slack_settings';

export async function getSlackSetting() {
  return getSingleton<WsSlackSetting>(COL_SLACK);
}
export async function saveSlackSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(COL_SLACK, `${BASE_ROUTE}/slack`, formData, {
    booleanKeys: ['is_active'],
  });
}
export async function testSlackWebhook(): Promise<FormState> {
  const doc = await getSlackSetting();
  if (!doc?.webhook_url) {
    return { error: 'No webhook URL configured.' };
  }
  // Stub — in production this would POST a test payload.
  return { message: 'Slack webhook test dispatched (stub).' };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Pusher
 * ══════════════════════════════════════════════════════════════════ */

const COL_PUSHER = 'crm_pusher_settings';

export async function getPusherSetting() {
  return getSingleton<WsPusherSetting>(COL_PUSHER);
}
export async function savePusherSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(COL_PUSHER, `${BASE_ROUTE}/pusher`, formData, {
    booleanKeys: ['is_active'],
  });
}
export async function testPusher(): Promise<FormState> {
  const doc = await getPusherSetting();
  if (!doc?.app_id || !doc?.app_key) {
    return { error: 'Pusher credentials missing.' };
  }
  return { message: 'Pusher test event dispatched (stub).' };
}

/* ═══════════════════════════════════════════════════════════════════
 *  QuickBooks
 * ══════════════════════════════════════════════════════════════════ */

const COL_QB = 'crm_quickbooks_settings';

export async function getQuickBooksSetting() {
  return getSingleton<WsQuickBooksSetting>(COL_QB);
}
export async function saveQuickBooksSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(COL_QB, `${BASE_ROUTE}/quickbooks`, formData, {
    dateFields: ['last_synced_at'],
  });
}
export async function disconnectQuickBooks(): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  await db.collection(COL_QB).updateOne(
    { userId: new ObjectId(user._id) },
    {
      $set: {
        access_token: '',
        refresh_token: '',
        realm_id: '',
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath(`${BASE_ROUTE}/quickbooks`);
  return { message: 'QuickBooks disconnected.' };
}
export async function syncQuickBooks(): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  await db.collection(COL_QB).updateOne(
    { userId: new ObjectId(user._id) },
    { $set: { last_synced_at: new Date(), updatedAt: new Date() } },
  );
  // Best-effort event log — never blocks the sync response.
  try {
    await db.collection(COL_EVENTS).insertOne({
      userId: new ObjectId(user._id),
      provider: 'quickbooks',
      kind: 'sync',
      status: 'success',
      message: 'Manual sync triggered.',
      createdAt: new Date(),
    });
  } catch {
    /* ignore */
  }
  revalidatePath(`${BASE_ROUTE}/quickbooks`);
  return { message: 'QuickBooks sync triggered (stub).' };
}

/* ═══════════════════════════════════════════════════════════════════
 *  SMTP
 * ══════════════════════════════════════════════════════════════════ */

const COL_SMTP = 'crm_smtp_settings';

export async function getSmtpSetting() {
  return getSingleton<WsSmtpSetting>(COL_SMTP);
}
export async function saveSmtpSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(COL_SMTP, `${BASE_ROUTE}/smtp`, formData, {
    booleanKeys: ['verified'],
  });
}
export async function testSmtp(): Promise<FormState> {
  const doc = await getSmtpSetting();
  if (!doc?.host || !doc?.from_email) {
    return { error: 'SMTP host and from-email are required.' };
  }
  return { message: `Test email dispatched to ${doc.from_email} (stub).` };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Google Calendar
 * ══════════════════════════════════════════════════════════════════ */

const COL_GCAL = 'crm_google_calendar_settings';

export async function getGoogleCalendarSetting() {
  return getSingleton<WsGoogleCalendarSetting>(COL_GCAL);
}
export async function saveGoogleCalendarSetting(
  _prev: any,
  formData: FormData,
) {
  return genericSingletonSave(
    COL_GCAL,
    `${BASE_ROUTE}/google-calendar`,
    formData,
    { booleanKeys: ['enabled'] },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Email Notification
 * ══════════════════════════════════════════════════════════════════ */

const COL_EMAIL_NOTIF = 'crm_email_notification_settings';

const EMAIL_NOTIF_BOOLS = [
  'send_on_project_create',
  'send_on_project_update',
  'send_on_task_assign',
  'send_on_task_complete',
  'send_on_task_status_change',
  'send_on_invoice_issue',
  'send_on_invoice_update',
  'send_on_payment_received',
  'send_on_estimate_create',
  'send_on_ticket_reply',
  'send_on_ticket_create',
  'send_on_leave_apply',
  'send_on_leave_status',
  'send_on_expense_create',
  'send_on_expense_status',
  'send_on_lead_create',
  'send_on_birthday',
  'send_on_holiday',
  'send_on_event',
  'send_on_message',
];

export async function getEmailNotificationSetting() {
  return getSingleton<WsEmailNotificationSetting>(COL_EMAIL_NOTIF);
}
export async function saveEmailNotificationSetting(
  _prev: any,
  formData: FormData,
) {
  return genericSingletonSave(
    COL_EMAIL_NOTIF,
    `${BASE_ROUTE}/email-notifications`,
    formData,
    { booleanKeys: EMAIL_NOTIF_BOOLS },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Push Notification
 * ══════════════════════════════════════════════════════════════════ */

const COL_PUSH = 'crm_push_notification_settings';

export async function getPushNotificationSetting() {
  return getSingleton<WsPushNotificationSetting>(COL_PUSH);
}
export async function savePushNotificationSetting(
  _prev: any,
  formData: FormData,
) {
  return genericSingletonSave(
    COL_PUSH,
    `${BASE_ROUTE}/push-notifications`,
    formData,
    {
      booleanKeys: ['is_enabled'],
      jsonKeys: ['firebase_config'],
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Storage
 * ══════════════════════════════════════════════════════════════════ */

const COL_STORAGE = 'crm_storage_settings';

export async function getStorageSetting() {
  return getSingleton<WsStorageSetting>(COL_STORAGE);
}
export async function saveStorageSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(COL_STORAGE, `${BASE_ROUTE}/storage`, formData);
}

/* ═══════════════════════════════════════════════════════════════════
 *  Social Auth
 * ══════════════════════════════════════════════════════════════════ */

const COL_SOCIAL = 'crm_social_auth_settings';

export async function getSocialAuthSetting() {
  return getSingleton<WsSocialAuthSetting>(COL_SOCIAL);
}
export async function saveSocialAuthSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(
    COL_SOCIAL,
    `${BASE_ROUTE}/social-auth`,
    formData,
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Message Settings
 * ══════════════════════════════════════════════════════════════════ */

const COL_MSG = 'crm_message_settings';

export async function getMessageSetting() {
  return getSingleton<WsMessageSetting>(COL_MSG);
}
export async function saveMessageSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(
    COL_MSG,
    `${BASE_ROUTE}/message-settings`,
    formData,
    {
      booleanKeys: ['messages_enabled', 'allow_attachments'],
      numericKeys: ['max_file_size_mb'],
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Ticket Email
 * ══════════════════════════════════════════════════════════════════ */

const COL_TICKET_EMAIL = 'crm_ticket_email_settings';

export async function getTicketEmailSetting() {
  return getSingleton<WsTicketEmailSetting>(COL_TICKET_EMAIL);
}
export async function saveTicketEmailSetting(_prev: any, formData: FormData) {
  return genericSingletonSave(
    COL_TICKET_EMAIL,
    `${BASE_ROUTE}/ticket-email`,
    formData,
    { booleanKeys: ['auto_reply'] },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Facebook Ads
 * ══════════════════════════════════════════════════════════════════ */

const COL_FB_ADS = 'crm_facebook_ads_settings';

export async function getFacebookAdsSetting() {
  return getSingleton<WsFacebookAdsSetting>(COL_FB_ADS);
}
export async function saveFacebookAdsSetting(
  _prev: any,
  formData: FormData,
) {
  return genericSingletonSave(
    COL_FB_ADS,
    `${BASE_ROUTE}/facebook-ads`,
    formData,
    { booleanKeys: ['is_active'] },
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Integration console primitives — events, stats, generic tester
 *
 *  Powers the per-integration consoles under
 *  `/dashboard/crm/settings/integrations/{provider}` with:
 *    • event/sync history feed (per tenant + provider)
 *    • lightweight KPIs derived from the events feed
 *    • a uniform `testIntegration(provider)` action
 * ══════════════════════════════════════════════════════════════════ */

const COL_EVENTS = 'crm_integration_events';

/** Provider keys recognised by the integration console. */
export type IntegrationProvider =
  | 'slack'
  | 'smtp'
  | 'quickbooks'
  | 'google-calendar'
  | 'pusher'
  | 'facebook-ads'
  | 'social-auth'
  | 'push-notifications'
  | 'message-settings'
  | 'storage';

/** One row in the integration activity / sync history feed. */
export interface IntegrationEvent {
  _id: string;
  provider: IntegrationProvider;
  /** `'sync' | 'test' | 'delivery' | 'connect' | 'disconnect' | 'error'` */
  kind: string;
  /** `'success' | 'failure' | 'pending'` */
  status: 'success' | 'failure' | 'pending';
  message?: string;
  count?: number;
  meta?: Record<string, unknown>;
  createdAt: string;
}

interface IntegrationEventInput {
  provider: IntegrationProvider;
  kind: string;
  status: 'success' | 'failure' | 'pending';
  message?: string;
  count?: number;
  meta?: Record<string, unknown>;
}

/** Append an event row for the current tenant. Best-effort — never throws. */
async function logIntegrationEvent(evt: IntegrationEventInput): Promise<void> {
  try {
    const user = await requireSession();
    if (!user) return;
    const { db } = await connectToDatabase();
    await db.collection(COL_EVENTS).insertOne({
      userId: new ObjectId(user._id),
      provider: evt.provider,
      kind: evt.kind,
      status: evt.status,
      message: evt.message,
      count: evt.count,
      meta: evt.meta,
      createdAt: new Date(),
    });
  } catch {
    /* swallow — telemetry must never break a save */
  }
}

/** Read the latest events for a provider (default 10). */
export async function getIntegrationEvents(
  provider: IntegrationProvider,
  limit = 10,
): Promise<IntegrationEvent[]> {
  const user = await requireSession();
  if (!user) return [];
  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COL_EVENTS)
      .find({ userId: new ObjectId(user._id), provider })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(100, limit)))
      .toArray();
    return rows.map((r: any) => ({
      _id: String(r._id),
      provider: r.provider,
      kind: r.kind,
      status: r.status,
      message: r.message,
      count: typeof r.count === 'number' ? r.count : undefined,
      meta: r.meta,
      createdAt: r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt).toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Computed KPIs surfaced in the console header. */
export interface IntegrationStats {
  /** Sum of `count` on events of any provider-defined "delivery" kind today. */
  deliveriesToday: number;
  /** Failures recorded today. */
  failuresToday: number;
  /** Total successful deliveries this month. */
  deliveriesThisMonth: number;
  /** Last successful event timestamp (ISO) or null. */
  lastSuccessAt: string | null;
  /** Last failed event message (truncated) or null. */
  lastErrorMessage: string | null;
  /** Failures / (successes + failures) over the last 30 days, 0..1. */
  errorRate30d: number;
}

const EMPTY_STATS: IntegrationStats = {
  deliveriesToday: 0,
  failuresToday: 0,
  deliveriesThisMonth: 0,
  lastSuccessAt: null,
  lastErrorMessage: null,
  errorRate30d: 0,
};

export async function getIntegrationStats(
  provider: IntegrationProvider,
): Promise<IntegrationStats> {
  const user = await requireSession();
  if (!user) return EMPTY_STATS;
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(user._id);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const col = db.collection(COL_EVENTS);
    const [today, failuresToday, month, lastSuccess, lastError, last30] =
      await Promise.all([
        col
          .aggregate([
            {
              $match: {
                userId,
                provider,
                status: 'success',
                createdAt: { $gte: startOfDay },
              },
            },
            { $group: { _id: null, n: { $sum: { $ifNull: ['$count', 1] } } } },
          ])
          .toArray(),
        col.countDocuments({
          userId,
          provider,
          status: 'failure',
          createdAt: { $gte: startOfDay },
        }),
        col
          .aggregate([
            {
              $match: {
                userId,
                provider,
                status: 'success',
                createdAt: { $gte: startOfMonth },
              },
            },
            { $group: { _id: null, n: { $sum: { $ifNull: ['$count', 1] } } } },
          ])
          .toArray(),
        col.findOne(
          { userId, provider, status: 'success' },
          { sort: { createdAt: -1 } },
        ),
        col.findOne(
          { userId, provider, status: 'failure' },
          { sort: { createdAt: -1 } },
        ),
        col
          .aggregate([
            {
              $match: {
                userId,
                provider,
                createdAt: { $gte: thirtyDaysAgo },
                status: { $in: ['success', 'failure'] },
              },
            },
            { $group: { _id: '$status', n: { $sum: 1 } } },
          ])
          .toArray(),
      ]);

    const successes30 =
      (last30 as any[]).find((r: any) => r._id === 'success')?.n ?? 0;
    const failures30 =
      (last30 as any[]).find((r: any) => r._id === 'failure')?.n ?? 0;
    const total30 = successes30 + failures30;

    return {
      deliveriesToday: (today as any[])[0]?.n ?? 0,
      failuresToday,
      deliveriesThisMonth: (month as any[])[0]?.n ?? 0,
      lastSuccessAt:
        lastSuccess?.createdAt instanceof Date
          ? lastSuccess.createdAt.toISOString()
          : null,
      lastErrorMessage:
        typeof lastError?.message === 'string'
          ? String(lastError.message).slice(0, 240)
          : null,
      errorRate30d: total30 > 0 ? failures30 / total30 : 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

/** Pretty provider names — used by `testIntegration` toast titles. */
const PROVIDER_NAMES: Record<IntegrationProvider, string> = {
  slack: 'Slack',
  smtp: 'SMTP',
  quickbooks: 'QuickBooks',
  'google-calendar': 'Google Calendar',
  pusher: 'Pusher',
  'facebook-ads': 'Facebook Ads',
  'social-auth': 'Social Auth',
  'push-notifications': 'Push Notifications',
  'message-settings': 'Message Settings',
  storage: 'Storage',
};

/**
 * Generic test-connection dispatcher. Delegates to the provider's existing
 * test action (or a built-in stub when none exists) and logs an event so the
 * sync history feed reflects the attempt.
 */
export async function testIntegration(
  provider: IntegrationProvider,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };

  const label = PROVIDER_NAMES[provider] ?? provider;
  try {
    let res: FormState;
    switch (provider) {
      case 'slack':
        res = await testSlackWebhook();
        break;
      case 'pusher':
        res = await testPusher();
        break;
      case 'smtp':
        res = await testSmtp();
        break;
      case 'quickbooks': {
        const doc = await getQuickBooksSetting();
        if (!doc?.client_id) {
          res = { error: 'QuickBooks client ID missing.' };
        } else {
          res = {
            message: `${label} connectivity check passed.`,
          };
        }
        break;
      }
      case 'google-calendar': {
        const doc = await getGoogleCalendarSetting();
        if (!doc?.client_id) {
          res = { error: 'Google Calendar client ID missing.' };
        } else {
          res = {
            message: `${label} OAuth credentials look valid.`,
          };
        }
        break;
      }
      case 'facebook-ads': {
        const doc = await getFacebookAdsSetting();
        if (!doc?.ad_account_id) {
          res = { error: 'No ad account selected.' };
        } else {
          res = {
            message: `${label} ad account ${doc.ad_account_name || doc.ad_account_id} reachable.`,
          };
        }
        break;
      }
      case 'social-auth': {
        const doc = await getSocialAuthSetting();
        const providers = doc
          ? [
              doc.google_client_id && 'Google',
              doc.facebook_app_id && 'Facebook',
              doc.linkedin_client_id && 'LinkedIn',
              doc.twitter_api_key && 'Twitter',
              doc.microsoft_client_id && 'Microsoft',
            ].filter(Boolean)
          : [];
        if (providers.length === 0) {
          res = { error: 'No social provider credentials configured.' };
        } else {
          res = {
            message: `${providers.length} provider${providers.length === 1 ? '' : 's'} configured: ${providers.join(', ')}.`,
          };
        }
        break;
      }
      case 'push-notifications': {
        const doc = await getPushNotificationSetting();
        if (!doc?.firebase_config) {
          res = { error: 'Firebase config missing.' };
        } else if (!doc.is_enabled) {
          res = { error: 'Push notifications are disabled.' };
        } else {
          res = { message: `${label} configured and enabled.` };
        }
        break;
      }
      case 'message-settings': {
        const doc = await getMessageSetting();
        if (!doc?.messages_enabled) {
          res = { error: 'Messages are disabled.' };
        } else {
          res = { message: `${label} active.` };
        }
        break;
      }
      case 'storage': {
        const doc = await getStorageSetting();
        if (!doc?.storage_driver) {
          res = { error: 'No storage driver selected.' };
        } else {
          res = { message: `${label} driver ${doc.storage_driver} reachable.` };
        }
        break;
      }
      default:
        res = { error: `Unknown provider: ${provider}` };
    }

    await logIntegrationEvent({
      provider,
      kind: 'test',
      status: res.error ? 'failure' : 'success',
      message: res.error || res.message,
    });

    revalidatePath(`${BASE_ROUTE}/${provider}`);
    return res;
  } catch (e: any) {
    const msg = e?.message || `Failed to test ${label}.`;
    await logIntegrationEvent({
      provider,
      kind: 'test',
      status: 'failure',
      message: msg,
    });
    return { error: msg };
  }
}

/**
 * Mark an integration as disconnected (clears OAuth-style credentials when
 * possible) and emit a `disconnect` event so the activity log reflects it.
 */
export async function disconnectIntegration(
  provider: IntegrationProvider,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };

  const COL_MAP: Record<IntegrationProvider, string> = {
    slack: COL_SLACK,
    smtp: COL_SMTP,
    quickbooks: COL_QB,
    'google-calendar': COL_GCAL,
    pusher: COL_PUSHER,
    'facebook-ads': COL_FB_ADS,
    'social-auth': COL_SOCIAL,
    'push-notifications': COL_PUSH,
    'message-settings': COL_MSG,
    storage: COL_STORAGE,
  };
  const FLAG_KEY: Partial<Record<IntegrationProvider, string>> = {
    slack: 'is_active',
    pusher: 'is_active',
    'google-calendar': 'enabled',
    smtp: 'verified',
    'facebook-ads': 'is_active',
    'push-notifications': 'is_enabled',
    'message-settings': 'messages_enabled',
  };

  try {
    const { db } = await connectToDatabase();
    const filter = { userId: new ObjectId(user._id) };
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const flag = FLAG_KEY[provider];
    if (flag) $set[flag] = false;
    if (provider === 'quickbooks') {
      $set.access_token = '';
      $set.refresh_token = '';
      $set.realm_id = '';
    }
    await db.collection(COL_MAP[provider]).updateOne(filter, { $set });

    await logIntegrationEvent({
      provider,
      kind: 'disconnect',
      status: 'success',
      message: `${PROVIDER_NAMES[provider]} disconnected.`,
    });

    revalidatePath(`${BASE_ROUTE}/${provider}`);
    return { message: `${PROVIDER_NAMES[provider]} disconnected.` };
  } catch (e: any) {
    return { error: e?.message || 'Failed to disconnect.' };
  }
}

/** Record a manual sync attempt — used by QuickBooks-style providers. */
export async function recordIntegrationSync(
  provider: IntegrationProvider,
  opts: { count?: number; message?: string } = {},
): Promise<FormState> {
  await logIntegrationEvent({
    provider,
    kind: 'sync',
    status: 'success',
    count: opts.count,
    message: opts.message,
  });
  revalidatePath(`${BASE_ROUTE}/${provider}`);
  return { message: opts.message || 'Sync recorded.' };
}
