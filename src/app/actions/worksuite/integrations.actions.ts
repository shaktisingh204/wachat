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
