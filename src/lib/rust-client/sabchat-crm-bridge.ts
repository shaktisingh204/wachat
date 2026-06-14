/**
 * Client for `/v1/sabchat/crm-bridge/*` — links a SabChat contact/conversation
 * to the SabCRM record graph (contacts, deals, tickets, bookings). Owned by the
 * `sabchat-crm-bridge` Rust crate. Every mutating endpoint returns the resolved
 * foreign-key id so the caller can chain follow-up writes without a second hop.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface CrmLinkContactResult {
  sabchatContactId: string;
  crmContactId: string;
  created: boolean;
}

export interface CrmConversationToDealResult {
  conversationId: string;
  crmContactId: string;
  dealId: string;
}

export interface CrmConversationToTicketResult {
  conversationId: string;
  crmContactId: string;
  ticketId: string;
}

export interface CrmConversationToBookingResult {
  conversationId: string;
  crmContactId: string;
  bookingId: string;
}

export const sabchatCrmBridgeApi = {
  linkContact: (sabchatContactId: string, body: { crmContactId?: string } = {}) =>
    rustFetch<CrmLinkContactResult>(`/v1/sabchat/crm-bridge/link-contact/${sabchatContactId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  pushToCrm: (sabchatContactId: string) =>
    rustFetch<CrmLinkContactResult>(`/v1/sabchat/crm-bridge/push-to-crm/${sabchatContactId}`, {
      method: 'POST',
    }),

  pullFromCrm: (sabchatContactId: string) =>
    rustFetch<CrmLinkContactResult>(`/v1/sabchat/crm-bridge/pull-from-crm/${sabchatContactId}`, {
      method: 'POST',
    }),

  conversationToDeal: (
    conversationId: string,
    body: { pipelineId: string; stageId?: string; title?: string; amount?: number },
  ) =>
    rustFetch<CrmConversationToDealResult>(
      `/v1/sabchat/crm-bridge/conversation-to-deal/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  conversationToTicket: (
    conversationId: string,
    body: { subject?: string; priority?: string } = {},
  ) =>
    rustFetch<CrmConversationToTicketResult>(
      `/v1/sabchat/crm-bridge/conversation-to-ticket/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  conversationToBooking: (
    conversationId: string,
    body: { serviceId: string; startAt: string },
  ) =>
    rustFetch<CrmConversationToBookingResult>(
      `/v1/sabchat/crm-bridge/conversation-to-booking/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
