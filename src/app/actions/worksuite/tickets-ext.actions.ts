'use server';

import { revalidatePath } from 'next/cache';
import { hrList, hrGetById, hrSave, hrDelete, formToObject } from '@/lib/hr-crud';
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

type FormState = { message?: string; error?: string; id?: string };

const ROUTE_BASE = '/dashboard/crm/tickets';

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
  return genericSave(COL_REPLIES, `${ROUTE_BASE}`, formData, {
    jsonKeys: ['attachments'],
  });
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
