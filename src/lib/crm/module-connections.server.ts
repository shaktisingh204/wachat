import 'server-only';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  CrmConnectionModuleKey,
  CrmModuleConnection,
} from '@/lib/worksuite/module-connections-types';

/**
 * Server-only helpers for reading CRM ↔ module connections.
 *
 * Source of truth: collection `crm_module_connections`. Written by the
 * wizards under `/dashboard/crm/settings/integrations/*`; consumed here
 * by the underlying modules (email, sms, sabfiles, ad-manager) when they
 * dispatch on behalf of the CRM.
 *
 * All getters require a `userId` (the tenant owner). When the connection
 * doc is missing or `status !== 'connected'`, getters return `null` so
 * callers can fall back to legacy behavior.
 */

const COLLECTION = 'crm_module_connections';

async function readConnection(
  userId: string | ObjectId,
  moduleKey: CrmConnectionModuleKey,
): Promise<CrmModuleConnection | null> {
  const { db } = await connectToDatabase();
  const doc = (await db.collection(COLLECTION).findOne({
    userId: typeof userId === 'string' ? new ObjectId(userId) : userId,
    moduleKey,
    status: 'connected',
  })) as CrmModuleConnection | null;
  return doc;
}

/* ── Storage → SabFiles ──────────────────────────────────────────── */

export interface CrmStorageBinding {
  rootFolderId: string | null;
  rootFolderName?: string;
  autoOrganize: boolean;
}

export async function getCrmStorageBinding(
  userId: string | ObjectId,
): Promise<CrmStorageBinding | null> {
  const c = await readConnection(userId, 'storage');
  if (!c) return null;
  return {
    rootFolderId: (c.config.rootFolderId as string | null) ?? null,
    rootFolderName: c.config.rootFolderName as string | undefined,
    autoOrganize: Boolean(c.config.autoOrganize),
  };
}

/**
 * Resolve the SabFiles parent folder ID for a CRM upload, optionally
 * scoped to a CRM module so `autoOrganize` can partition by area.
 * Falls back to `null` (root) when no connection exists.
 */
export async function resolveCrmUploadParent(
  userId: string | ObjectId,
  scope?: string,
): Promise<string | null> {
  const b = await getCrmStorageBinding(userId);
  if (!b) return null;
  // Note: subfolder *creation* happens at upload time in the SabFiles
  // module; this helper just returns the configured root. Auto-organize
  // is a behavior flag the uploader can read separately via
  // `getCrmStorageBinding`.
  return b.rootFolderId;
}

/* ── SMTP → Email module ─────────────────────────────────────────── */

export interface CrmSmtpBinding {
  fromAddress: string;
  fromName?: string;
  replyTo?: string;
}

export async function getCrmSmtpBinding(
  userId: string | ObjectId,
): Promise<CrmSmtpBinding | null> {
  const c = await readConnection(userId, 'smtp');
  if (!c) return null;
  const fromAddress = c.config.fromAddress as string | undefined;
  if (!fromAddress) return null;
  return {
    fromAddress,
    fromName: c.config.fromName as string | undefined,
    replyTo: c.config.replyTo as string | undefined,
  };
}

export function formatSmtpFromHeader(b: CrmSmtpBinding): string {
  if (b.fromName) return `"${b.fromName}" <${b.fromAddress}>`;
  return b.fromAddress;
}

/* ── Email notifications ─────────────────────────────────────────── */

export async function isCrmEmailEventEnabled(
  userId: string | ObjectId,
  eventKey: string,
): Promise<boolean> {
  const c = await readConnection(userId, 'email-notifications');
  // No connection = enabled by default (legacy behavior).
  if (!c) return true;
  const events = (c.config.events ?? {}) as Record<string, boolean>;
  // If event is not listed, default to disabled to be explicit.
  return Boolean(events[eventKey]);
}

/* ── Ticket email ────────────────────────────────────────────────── */

export interface CrmTicketEmailBinding {
  inboxAddress: string;
  autoCreateTicket: boolean;
  defaultCategory?: string;
  defaultAssignee?: string;
}

export async function getCrmTicketEmailBinding(
  userId: string | ObjectId,
): Promise<CrmTicketEmailBinding | null> {
  const c = await readConnection(userId, 'ticket-email');
  if (!c) return null;
  const inboxAddress = c.config.inboxAddress as string | undefined;
  if (!inboxAddress) return null;
  return {
    inboxAddress,
    autoCreateTicket: Boolean(c.config.autoCreateTicket),
    defaultCategory: c.config.defaultCategory as string | undefined,
    defaultAssignee: c.config.defaultAssignee as string | undefined,
  };
}

/**
 * Look up the tenant whose ticket-email binding matches the given
 * inbound recipient address. Used by the Email module when an incoming
 * message arrives — if a binding matches, the Email module fires
 * `ingestTicketEmail` for that tenant.
 */
export async function findTenantByTicketInbox(
  inboxAddress: string,
): Promise<{ userId: string; binding: CrmTicketEmailBinding } | null> {
  if (!inboxAddress) return null;
  const { db } = await connectToDatabase();
  const doc = (await db.collection(COLLECTION).findOne({
    moduleKey: 'ticket-email',
    status: 'connected',
    'config.inboxAddress': inboxAddress.toLowerCase(),
  })) as CrmModuleConnection | null;
  if (!doc) {
    // Try case-sensitive too in case the binding wasn't lowercased.
    const fallback = (await db.collection(COLLECTION).findOne({
      moduleKey: 'ticket-email',
      status: 'connected',
      'config.inboxAddress': inboxAddress,
    })) as CrmModuleConnection | null;
    if (!fallback) return null;
    return {
      userId: String(fallback.userId),
      binding: {
        inboxAddress: fallback.config.inboxAddress,
        autoCreateTicket: Boolean(fallback.config.autoCreateTicket),
        defaultCategory: fallback.config.defaultCategory,
        defaultAssignee: fallback.config.defaultAssignee,
      },
    };
  }
  return {
    userId: String(doc.userId),
    binding: {
      inboxAddress: doc.config.inboxAddress,
      autoCreateTicket: Boolean(doc.config.autoCreateTicket),
      defaultCategory: doc.config.defaultCategory,
      defaultAssignee: doc.config.defaultAssignee,
    },
  };
}

/* ── Facebook ads → Ad Manager ───────────────────────────────────── */

export interface CrmFbAdsBinding {
  adAccountId: string;
  adAccountName?: string;
  leadFormIds: string[];
  defaultPipeline?: string;
  defaultStage?: string;
}

export async function getCrmFbAdsBinding(
  userId: string | ObjectId,
): Promise<CrmFbAdsBinding | null> {
  const c = await readConnection(userId, 'facebook-ads');
  if (!c) return null;
  const adAccountId = c.config.adAccountId as string | undefined;
  if (!adAccountId) return null;
  const raw = (c.config.leadFormIds as string | undefined) ?? '';
  const leadFormIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    adAccountId,
    adAccountName: c.config.adAccountName as string | undefined,
    leadFormIds,
    defaultPipeline: c.config.defaultPipeline as string | undefined,
    defaultStage: c.config.defaultStage as string | undefined,
  };
}

/**
 * Decide whether to forward a Meta lead-gen event into the CRM, based
 * on the tenant's facebook-ads binding. When no binding exists, returns
 * `true` (legacy: forward everything). When a binding exists, only
 * forms in `leadFormIds` are forwarded — empty list means "all forms".
 */
export async function shouldForwardFbLeadToCrm(
  userId: string | ObjectId,
  formId: string,
): Promise<{ forward: boolean; routing?: { pipeline?: string; stage?: string } }> {
  const b = await getCrmFbAdsBinding(userId);
  if (!b) return { forward: true };
  if (b.leadFormIds.length > 0 && !b.leadFormIds.includes(formId)) {
    return { forward: false };
  }
  return {
    forward: true,
    routing: { pipeline: b.defaultPipeline, stage: b.defaultStage },
  };
}

/* ── Message settings → SMS module ───────────────────────────────── */

export interface CrmSmsBinding {
  senderId: string;
  templatePrefix?: string;
  triggers: Record<string, boolean>;
}

export async function getCrmSmsBinding(
  userId: string | ObjectId,
): Promise<CrmSmsBinding | null> {
  const c = await readConnection(userId, 'message-settings');
  if (!c) return null;
  const senderId = c.config.senderId as string | undefined;
  if (!senderId) return null;
  return {
    senderId,
    templatePrefix: c.config.templatePrefix as string | undefined,
    triggers: (c.config.triggers ?? {}) as Record<string, boolean>,
  };
}

export async function isCrmSmsTriggerEnabled(
  userId: string | ObjectId,
  triggerKey: string,
): Promise<boolean> {
  const b = await getCrmSmsBinding(userId);
  if (!b) return false; // No binding = no CRM SMS at all.
  return Boolean(b.triggers[triggerKey]);
}
