'use server';

/**
 * SabBigin ↔ WaChat bridge. Surfaces a contact's WhatsApp conversation on the
 * SabBigin contact/deal pages by matching the CRM contact's phone to the
 * tenant's WaChat project, reusing WaChat's own conversation + send actions.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getProjects } from '@/app/actions/project.actions';
import {
  getConversation,
  handleSendMessage,
  findOrCreateContact,
} from '@/app/actions/whatsapp.actions';

export interface WhatsappMessageLite {
  id: string;
  direction: 'in' | 'out';
  text: string;
  type: string;
  timestamp: string | null;
  status?: string | null;
}

export interface SabbiginWhatsappThread {
  connected: boolean;
  reason?: string;
  projectId?: string;
  phoneNumberId?: string;
  waId?: string;
  wachatContactId?: string;
  messages: WhatsappMessageLite[];
}

/** Pull the text out of a Meta message payload, best-effort. */
function extractText(content: any, type: string): string {
  if (!content) return '';
  if (type === 'text') return content.text?.body ?? content.body ?? '';
  if (content.text?.body) return content.text.body;
  if (content.caption) return content.caption;
  if (content.body) return content.body;
  return `[${type}]`;
}

function toWaId(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '');
}

export async function getSabbiginWhatsappThread(
  crmContactId: string,
): Promise<SabbiginWhatsappThread> {
  const empty = (reason: string): SabbiginWhatsappThread => ({
    connected: false,
    reason,
    messages: [],
  });

  const session = await getSession();
  if (!session?.user?._id) return empty('Not signed in');
  if (!crmContactId || !ObjectId.isValid(crmContactId))
    return empty('Invalid contact');

  try {
    const { db } = await connectToDatabase();
    const contact = await db
      .collection('crm_contacts')
      .findOne({ _id: new ObjectId(crmContactId), userId: new ObjectId(session.user._id) });
    const phone = contact?.phone ? String(contact.phone) : '';
    const waId = toWaId(phone);
    if (!waId || waId.length < 8) return empty('No WhatsApp number on this contact');

    const projects = await getProjects(undefined, 'whatsapp');
    const project = projects.find((p) => p.phoneNumbers?.length) ?? projects[0];
    const phoneNumberId = project?.phoneNumbers?.[0]?.id;
    if (!project || !phoneNumberId)
      return empty('Connect WhatsApp in WaChat first');

    const projectId = String(project._id);

    const found = await findOrCreateContact(projectId, phoneNumberId, waId);
    if (!found.contact) return empty(found.error ?? 'Could not open conversation');
    const wachatContactId = String(found.contact._id);

    const raw = await getConversation(wachatContactId);
    const messages: WhatsappMessageLite[] = (raw ?? []).map((m: any, i: number) => ({
      id: String(m.wamid ?? m._id ?? i),
      direction: m.direction === 'out' ? 'out' : 'in',
      text: extractText(m.content, m.type ?? 'text'),
      type: m.type ?? 'text',
      timestamp: m.messageTimestamp
        ? new Date(m.messageTimestamp).toISOString()
        : null,
      status: m.status ?? null,
    }));

    return {
      connected: true,
      projectId,
      phoneNumberId,
      waId,
      wachatContactId,
      messages,
    };
  } catch (e: any) {
    return empty(e?.message ?? 'Failed to load conversation');
  }
}

export async function sendSabbiginWhatsapp(input: {
  projectId: string;
  phoneNumberId: string;
  waId: string;
  wachatContactId: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!input.text.trim()) return { success: false, error: 'Message is empty' };
  try {
    const res = await handleSendMessage(null, {
      contactId: input.wachatContactId,
      projectId: input.projectId,
      phoneNumberId: input.phoneNumberId,
      waId: input.waId,
      messageText: input.text,
    });
    if (res?.error) return { success: false, error: res.error };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to send' };
  }
}
