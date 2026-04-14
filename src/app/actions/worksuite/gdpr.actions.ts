'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsGdprSetting,
  WsPurposeConsent,
  WsPurposeConsentLead,
  WsPurposeConsentUser,
  WsRemovalRequest,
  WsRemovalRequestLead,
  WsRemovalRequestStatus,
  WsRemovalRequestType,
} from '@/lib/worksuite/gdpr-types';

type FormState = { message?: string; error?: string; id?: string };

const ROUTE_BASE = '/dashboard/crm/settings/gdpr';

/* ── Collections ─────────────────────────────────────────────────── */

const COL_SETTINGS = 'crm_gdpr_settings';
const COL_PURPOSES = 'crm_purpose_consents';
const COL_CONSENT_LEADS = 'crm_purpose_consent_leads';
const COL_CONSENT_USERS = 'crm_purpose_consent_users';
const COL_REMOVAL = 'crm_removal_requests';
const COL_REMOVAL_LEADS = 'crm_removal_request_leads';

/* ── Helpers ─────────────────────────────────────────────────────── */

async function getRequestMeta(): Promise<{ ip: string; ua: string }> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0].trim() ||
      h.get('x-real-ip') ||
      '';
    const ua = h.get('user-agent') || '';
    return { ip, ua };
  } catch {
    return { ip: '', ua: '' };
  }
}

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    booleanKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.booleanKeys || []) {
      if (data[k] !== undefined) {
        data[k] = data[k] === 'true' || data[k] === 'on' || data[k] === true;
      } else {
        data[k] = false;
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ── GDPR Settings (singleton) ───────────────────────────────────── */

const SETTINGS_BOOL_KEYS = [
  'enable_gdpr',
  'show_cookie_consent',
  'enable_consent_logs',
  'enable_right_to_be_forgotten',
  'enable_data_portability',
];

export async function getGdprSettings(): Promise<WsGdprSetting | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(COL_SETTINGS)
    .findOne({ userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as WsGdprSetting) : null;
}

export async function saveGdprSettings(
  _prev: any,
  formData: FormData,
): Promise<FormState> {
  // Singleton: find existing and inject its _id so hrSave does an update.
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  const existing = await db
    .collection(COL_SETTINGS)
    .findOne({ userId: new ObjectId(user._id) });
  if (existing && !formData.get('_id')) {
    formData.set('_id', String(existing._id));
  }
  return genericSave(COL_SETTINGS, ROUTE_BASE, formData, {
    numericKeys: ['retention_period_days'],
    booleanKeys: SETTINGS_BOOL_KEYS,
  });
}

/* ── Purpose Consents ────────────────────────────────────────────── */

export async function getPurposeConsents() {
  return hrList<WsPurposeConsent>(COL_PURPOSES, { sortBy: { sort_order: 1 } });
}
export async function getPurposeConsentById(id: string) {
  return hrGetById<WsPurposeConsent>(COL_PURPOSES, id);
}
export async function savePurposeConsent(_prev: any, formData: FormData) {
  return genericSave(COL_PURPOSES, `${ROUTE_BASE}/purposes`, formData, {
    numericKeys: ['sort_order'],
    booleanKeys: ['is_required', 'is_active'],
  });
}
export async function deletePurposeConsent(id: string) {
  const r = await hrDelete(COL_PURPOSES, id);
  revalidatePath(`${ROUTE_BASE}/purposes`);
  return r;
}

/* ── Consent logs (leads & users) ────────────────────────────────── */

export async function getPurposeConsentLeads() {
  return hrList<WsPurposeConsentLead>(COL_CONSENT_LEADS);
}
export async function getPurposeConsentUsers() {
  return hrList<WsPurposeConsentUser>(COL_CONSENT_USERS);
}

export async function getLeadConsents(leadId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COL_CONSENT_LEADS)
    .find({ userId: new ObjectId(user._id), lead_id: leadId })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as WsPurposeConsentLead[];
}

/**
 * Bulk grant — creates one consent row per purpose with IP/UA captured.
 */
export async function grantLeadConsent(
  leadId: string,
  purposeIds: string[],
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied' };
    if (!leadId) return { success: false, error: 'leadId required' };
    if (!Array.isArray(purposeIds) || purposeIds.length === 0) {
      return { success: true, count: 0 };
    }
    const { db } = await connectToDatabase();
    const { ip, ua } = await getRequestMeta();
    const now = new Date();
    const docs = purposeIds.map((pid) => ({
      userId: new ObjectId(user._id),
      lead_id: leadId,
      purpose_consent_id: pid,
      granted: true,
      granted_at: now,
      ip_address: ip,
      user_agent: ua,
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL_CONSENT_LEADS).insertMany(docs);
    revalidatePath(`${ROUTE_BASE}/consent-logs`);
    return { success: true, count: docs.length };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to grant' };
  }
}

export async function revokeLeadConsent(
  leadId: string,
  purposeId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied' };
    const { db } = await connectToDatabase();
    const { ip, ua } = await getRequestMeta();
    const now = new Date();
    await db.collection(COL_CONSENT_LEADS).insertOne({
      userId: new ObjectId(user._id),
      lead_id: leadId,
      purpose_consent_id: purposeId,
      granted: false,
      granted_at: now,
      ip_address: ip,
      user_agent: ua,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(`${ROUTE_BASE}/consent-logs`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to revoke' };
  }
}

export async function grantUserConsent(
  targetUserId: string,
  purposeIds: string[],
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied' };
    if (!Array.isArray(purposeIds) || purposeIds.length === 0) {
      return { success: true, count: 0 };
    }
    const { db } = await connectToDatabase();
    const { ip, ua } = await getRequestMeta();
    const now = new Date();
    const docs = purposeIds.map((pid) => ({
      userId: new ObjectId(user._id),
      target_user_id: targetUserId,
      purpose_consent_id: pid,
      granted: true,
      granted_at: now,
      ip_address: ip,
      user_agent: ua,
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL_CONSENT_USERS).insertMany(docs);
    revalidatePath(`${ROUTE_BASE}/consent-logs`);
    return { success: true, count: docs.length };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to grant' };
  }
}

/* ── Removal Requests ────────────────────────────────────────────── */

export async function getRemovalRequests() {
  return hrList<WsRemovalRequest>(COL_REMOVAL);
}

export async function getRemovalRequestLeads() {
  return hrList<WsRemovalRequestLead>(COL_REMOVAL_LEADS);
}

export interface SubmitRemovalRequestInput {
  requestType: WsRemovalRequestType;
  userId?: string;
  leadId?: string;
  requesterEmail?: string;
  reason?: string;
}

export async function submitRemovalRequest(
  input: SubmitRemovalRequestInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied' };
    const { db } = await connectToDatabase();
    const now = new Date();

    if (input.requestType === 'lead') {
      const doc = {
        userId: new ObjectId(user._id),
        lead_id: input.leadId || '',
        requester_email: input.requesterEmail || '',
        status: 'pending' as WsRemovalRequestStatus,
        reason: input.reason || '',
        submitted_at: now,
        createdAt: now,
        updatedAt: now,
      };
      const res = await db.collection(COL_REMOVAL_LEADS).insertOne(doc);
      revalidatePath(`${ROUTE_BASE}/removal-requests`);
      return { success: true, id: res.insertedId.toString() };
    }

    const doc = {
      userId: new ObjectId(user._id),
      user_id: input.userId || '',
      request_type: 'user' as WsRemovalRequestType,
      status: 'pending' as WsRemovalRequestStatus,
      reason: input.reason || '',
      submitted_at: now,
      createdAt: now,
      updatedAt: now,
    };
    const res = await db.collection(COL_REMOVAL).insertOne(doc);
    revalidatePath(`${ROUTE_BASE}/removal-requests`);
    return { success: true, id: res.insertedId.toString() };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to submit' };
  }
}

async function updateRemovalStatus(
  id: string,
  patch: Record<string, unknown>,
  collection: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireSession();
    if (!user) return { success: false, error: 'Access denied' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
    const { db } = await connectToDatabase();
    await db.collection(collection).updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(user._id) },
      { $set: { ...patch, updatedAt: new Date() } },
    );
    revalidatePath(`${ROUTE_BASE}/removal-requests`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update' };
  }
}

export async function approveRemovalRequest(
  id: string,
  variant: 'user' | 'lead' = 'user',
) {
  const user = await requireSession();
  return updateRemovalStatus(
    id,
    {
      status: 'approved',
      handled_at: new Date(),
      handled_by_user_id: user?._id || '',
    },
    variant === 'lead' ? COL_REMOVAL_LEADS : COL_REMOVAL,
  );
}

export async function rejectRemovalRequest(
  id: string,
  reason: string,
  variant: 'user' | 'lead' = 'user',
) {
  const user = await requireSession();
  return updateRemovalStatus(
    id,
    {
      status: 'rejected',
      reason,
      handled_at: new Date(),
      handled_by_user_id: user?._id || '',
    },
    variant === 'lead' ? COL_REMOVAL_LEADS : COL_REMOVAL,
  );
}

export async function completeRemovalRequest(
  id: string,
  variant: 'user' | 'lead' = 'user',
) {
  const user = await requireSession();
  return updateRemovalStatus(
    id,
    {
      status: 'completed',
      handled_at: new Date(),
      handled_by_user_id: user?._id || '',
    },
    variant === 'lead' ? COL_REMOVAL_LEADS : COL_REMOVAL,
  );
}

export async function deleteRemovalRequest(id: string) {
  const r = await hrDelete(COL_REMOVAL, id);
  revalidatePath(`${ROUTE_BASE}/removal-requests`);
  return r;
}

export async function deleteRemovalRequestLead(id: string) {
  const r = await hrDelete(COL_REMOVAL_LEADS, id);
  revalidatePath(`${ROUTE_BASE}/removal-requests`);
  return r;
}
