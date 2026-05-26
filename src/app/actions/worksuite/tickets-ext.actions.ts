'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  hrBulkDelete,
  formToObject,
  requireSession,
} from '@/lib/hr-crud';
import { connectToDatabase } from '@/lib/mongodb';
import { processMentionsFromBody } from '@/app/actions/mentions.actions';
import type {
  WsTicketChannel,
  WsTicketGroup,
  WsTicketType,
  WsTicketTag,
  WsTicketReplyTemplate,
  WsTicketCustomForm,
  WsTicketAgentGroup,
  WsTicketReply,
  WsTicketActivity,
} from '@/lib/worksuite/tickets-ext-types';

export type FormState = { message?: string; error?: string; id?: string };

const ROUTE_BASE = '/dashboard/sabdesk';

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    booleanKeys?: string[];
    jsonKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave as string */
        }
      }
    }
    for (const k of options.booleanKeys || []) {
      if (data[k] !== undefined) {
        data[k] = data[k] === 'true' || data[k] === 'on' || data[k] === true;
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

/* ── Settings-list KPI helper ───────────────────────────────────── */

export interface SettingsKpis {
  total: number;
  inUse: number;
  unused: number;
  lastAddedAt: string | null;
}

/**
 * Compute KPIs for a settings-list (lookup/category) entity:
 *   - total       : count of tenant docs
 *   - inUse       : count of distinct ids referenced in `usedBy.collection.field`
 *   - unused      : total - inUse
 *   - lastAddedAt : ISO of the most-recently-created doc (or null)
 */
async function settingsKpis(
  collection: string,
  usedBy: { collection: string; field: string } | null,
): Promise<SettingsKpis> {
  const user = await requireSession();
  if (!user) return { total: 0, inUse: 0, unused: 0, lastAddedAt: null };
  const { db } = await connectToDatabase();
  const userObjectId = new ObjectId(user._id);

  const total = await db
    .collection(collection)
    .countDocuments({ userId: userObjectId });

  const latest = await db
    .collection(collection)
    .find({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const lastAddedAt =
    latest[0]?.createdAt instanceof Date
      ? (latest[0].createdAt as Date).toISOString()
      : latest[0]?.createdAt
        ? String(latest[0].createdAt)
        : null;

  let inUse = 0;
  if (usedBy) {
    try {
      const ids = await db
        .collection(usedBy.collection)
        .distinct(usedBy.field, {
          userId: userObjectId,
          [usedBy.field]: { $exists: true, $ne: null },
        });
      // distinct may return ObjectIds or strings — normalise to strings.
      const seen = new Set<string>();
      for (const v of ids as unknown[]) {
        if (v == null) continue;
        seen.add(String(v));
      }
      inUse = seen.size;
    } catch {
      inUse = 0;
    }
  }

  return { total, inUse, unused: Math.max(0, total - inUse), lastAddedAt };
}

/* ── Ticket Channels ────────────────────────────────────────────── */

const COL_CHANNELS = 'crm_ticket_channels';

export async function getTicketChannels() {
  return hrList<WsTicketChannel>(COL_CHANNELS);
}
export async function saveTicketChannel(_prev: any, formData: FormData) {
  return genericSave(COL_CHANNELS, `${ROUTE_BASE}/channels`, formData);
}
export async function deleteTicketChannel(id: string) {
  const r = await hrDelete(COL_CHANNELS, id);
  revalidatePath(`${ROUTE_BASE}/channels`);
  return r;
}
export async function bulkDeleteTicketChannels(ids: string[]) {
  const r = await hrBulkDelete(COL_CHANNELS, ids);
  revalidatePath(`${ROUTE_BASE}/channels`);
  return r;
}
export async function getTicketChannelKpis(): Promise<SettingsKpis> {
  return settingsKpis(COL_CHANNELS, {
    collection: 'crm_tickets',
    field: 'channel_id',
  });
}

/* ── Ticket Groups ──────────────────────────────────────────────── */

const COL_GROUPS = 'crm_ticket_groups';

export async function getTicketGroups() {
  return hrList<WsTicketGroup>(COL_GROUPS);
}
export async function saveTicketGroup(_prev: any, formData: FormData) {
  return genericSave(COL_GROUPS, `${ROUTE_BASE}/groups`, formData);
}
export async function deleteTicketGroup(id: string) {
  const r = await hrDelete(COL_GROUPS, id);
  revalidatePath(`${ROUTE_BASE}/groups`);
  return r;
}

/* ── Ticket Types ───────────────────────────────────────────────── */

const COL_TYPES = 'crm_ticket_types';

export async function getTicketTypes() {
  return hrList<WsTicketType>(COL_TYPES);
}
export async function saveTicketType(_prev: any, formData: FormData) {
  return genericSave(COL_TYPES, `${ROUTE_BASE}/types`, formData);
}
export async function deleteTicketType(id: string) {
  const r = await hrDelete(COL_TYPES, id);
  revalidatePath(`${ROUTE_BASE}/types`);
  return r;
}

/* ── Ticket Tags ────────────────────────────────────────────────── */

const COL_TAGS = 'crm_ticket_tags';

export async function getTicketTags() {
  return hrList<WsTicketTag>(COL_TAGS);
}
export async function saveTicketTag(_prev: any, formData: FormData) {
  return genericSave(COL_TAGS, `${ROUTE_BASE}/tags`, formData);
}
export async function deleteTicketTag(id: string) {
  const r = await hrDelete(COL_TAGS, id);
  revalidatePath(`${ROUTE_BASE}/tags`);
  return r;
}
export async function bulkDeleteTicketTags(ids: string[]) {
  const r = await hrBulkDelete(COL_TAGS, ids);
  revalidatePath(`${ROUTE_BASE}/tags`);
  return r;
}
export async function getTicketTagKpis(): Promise<SettingsKpis> {
  // Tags are stored as an array per ticket; counting "in use" requires
  // scanning the join collection. We use the `crm_ticket_tag_list`
  // pivot collection (Laravel-era) when present, falling back to 0.
  return settingsKpis(COL_TAGS, {
    collection: 'crm_ticket_tag_list',
    field: 'tag_id',
  });
}

/* ── Ticket Reply Templates ────────────────────────────────────── */

const COL_REPLY_TEMPLATES = 'crm_ticket_reply_templates';

export async function getTicketReplyTemplates() {
  return hrList<WsTicketReplyTemplate>(COL_REPLY_TEMPLATES);
}
export async function saveTicketReplyTemplate(_prev: any, formData: FormData) {
  return genericSave(COL_REPLY_TEMPLATES, `${ROUTE_BASE}/reply-templates`, formData);
}
export async function deleteTicketReplyTemplate(id: string) {
  const r = await hrDelete(COL_REPLY_TEMPLATES, id);
  revalidatePath(`${ROUTE_BASE}/reply-templates`);
  return r;
}

/* ── Ticket Custom Forms ───────────────────────────────────────── */

const COL_CUSTOM_FORMS = 'crm_ticket_custom_forms';

export async function getTicketCustomForms() {
  return hrList<WsTicketCustomForm>(COL_CUSTOM_FORMS);
}
export async function saveTicketCustomForm(_prev: any, formData: FormData) {
  return genericSave(COL_CUSTOM_FORMS, `${ROUTE_BASE}/custom-forms`, formData, {
    booleanKeys: ['is_required'],
  });
}
export async function deleteTicketCustomForm(id: string) {
  const r = await hrDelete(COL_CUSTOM_FORMS, id);
  revalidatePath(`${ROUTE_BASE}/custom-forms`);
  return r;
}

/* ── Ticket Agent Groups ───────────────────────────────────────── */

const COL_AGENT_GROUPS = 'crm_ticket_agent_groups';

export async function getTicketAgentGroups() {
  return hrList<WsTicketAgentGroup>(COL_AGENT_GROUPS);
}
export async function saveTicketAgentGroup(_prev: any, formData: FormData) {
  return genericSave(COL_AGENT_GROUPS, `${ROUTE_BASE}/agent-groups`, formData);
}
export async function deleteTicketAgentGroup(id: string) {
  const r = await hrDelete(COL_AGENT_GROUPS, id);
  revalidatePath(`${ROUTE_BASE}/agent-groups`);
  return r;
}
export async function bulkDeleteTicketAgentGroups(ids: string[]) {
  const r = await hrBulkDelete(COL_AGENT_GROUPS, ids);
  revalidatePath(`${ROUTE_BASE}/agent-groups`);
  return r;
}
export async function getTicketAgentGroupKpis(): Promise<SettingsKpis> {
  // Agent-group mappings ARE the join rows — "in use" means the
  // referenced ticket group is currently active.
  return settingsKpis(COL_AGENT_GROUPS, {
    collection: 'crm_ticket_groups',
    field: '_id',
  });
}

/* ── Ticket Replies ─────────────────────────────────────────────── */

const COL_REPLIES = 'crm_ticket_replies';

export async function getTicketReplies(ticketId?: string) {
  if (ticketId) {
    return hrList<WsTicketReply>(COL_REPLIES, {
      extraFilter: { ticket_id: ticketId },
    });
  }
  return hrList<WsTicketReply>(COL_REPLIES);
}
export async function saveTicketReply(_prev: any, formData: FormData) {
  const result = await genericSave(COL_REPLIES, `${ROUTE_BASE}`, formData, {
    jsonKeys: ['attachments'],
  });
  if (result.id) {
    const ticketId = String(formData.get('ticket_id') ?? formData.get('ticketId') ?? result.id);
    const body = String(formData.get('body') ?? formData.get('message') ?? formData.get('reply') ?? '');
    await processMentionsFromBody('ticket_reply', ticketId, body);
  }
  return result;
}
export async function deleteTicketReply(id: string) {
  const r = await hrDelete(COL_REPLIES, id);
  revalidatePath(`${ROUTE_BASE}`);
  return r;
}

/* ── Ticket Activities ─────────────────────────────────────────── */

const COL_ACTIVITIES = 'crm_ticket_activities';

export async function getTicketActivities(ticketId?: string) {
  if (ticketId) {
    return hrList<WsTicketActivity>(COL_ACTIVITIES, {
      extraFilter: { ticket_id: ticketId },
    });
  }
  return hrList<WsTicketActivity>(COL_ACTIVITIES);
}
export async function saveTicketActivity(_prev: any, formData: FormData) {
  return genericSave(COL_ACTIVITIES, `${ROUTE_BASE}`, formData, {
    dateFields: ['timestamp'],
  });
}
export async function deleteTicketActivity(id: string) {
  const r = await hrDelete(COL_ACTIVITIES, id);
  revalidatePath(`${ROUTE_BASE}`);
  return r;
}
