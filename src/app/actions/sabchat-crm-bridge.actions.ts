'use server';

/**
 * SabChat ↔ SabCRM bridge server actions — project-scoped over the
 * `sabchat-crm-bridge` Rust crate (`/v1/sabchat/crm-bridge/*`). Lets an agent
 * push the person they're chatting with into the CRM record graph (contact,
 * deal, ticket, booking) straight from the inbox context pane.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export async function linkContactToCrm(
  sabchatContactId: string,
): Promise<{ ok: true; crmContactId: string; created: boolean } | { ok: false; error: string }> {
  if (!sabchatContactId) return { ok: false, error: 'No contact selected.' };
  try {
    const res = await scoped(() => rustClient.sabchatCrmBridge.linkContact(sabchatContactId));
    return { ok: true, crmContactId: res.crmContactId, created: res.created };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function pushContactToCrm(
  sabchatContactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sabchatContactId) return { ok: false, error: 'No contact selected.' };
  try {
    await scoped(() => rustClient.sabchatCrmBridge.pushToCrm(sabchatContactId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function pullContactFromCrm(
  sabchatContactId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sabchatContactId) return { ok: false, error: 'No contact selected.' };
  try {
    await scoped(() => rustClient.sabchatCrmBridge.pullFromCrm(sabchatContactId));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function conversationToTicket(
  conversationId: string,
  input: { subject?: string; priority?: string } = {},
): Promise<{ ok: true; ticketId: string } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  try {
    const res = await scoped(() =>
      rustClient.sabchatCrmBridge.conversationToTicket(conversationId, {
        subject: input.subject?.trim() || undefined,
        priority: input.priority?.trim() || undefined,
      }),
    );
    return { ok: true, ticketId: res.ticketId };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function conversationToDeal(
  conversationId: string,
  input: { pipelineId: string; stageId?: string; title?: string; amount?: number },
): Promise<{ ok: true; dealId: string } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  if (!input.pipelineId?.trim()) return { ok: false, error: 'A pipeline is required.' };
  try {
    const res = await scoped(() =>
      rustClient.sabchatCrmBridge.conversationToDeal(conversationId, {
        pipelineId: input.pipelineId.trim(),
        stageId: input.stageId?.trim() || undefined,
        title: input.title?.trim() || undefined,
        amount: typeof input.amount === 'number' ? input.amount : undefined,
      }),
    );
    return { ok: true, dealId: res.dealId };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function conversationToBooking(
  conversationId: string,
  input: { serviceId: string; startAt: string },
): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  if (!conversationId) return { ok: false, error: 'No conversation selected.' };
  if (!input.serviceId?.trim()) return { ok: false, error: 'A service is required.' };
  const when = new Date(input.startAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'Pick a valid start time.' };
  try {
    const res = await scoped(() =>
      rustClient.sabchatCrmBridge.conversationToBooking(conversationId, {
        serviceId: input.serviceId.trim(),
        startAt: when.toISOString(),
      }),
    );
    return { ok: true, bookingId: res.bookingId };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
