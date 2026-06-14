/**
 * Client for `/v1/sabchat/journeys/*` — outbound journeys: a sequence of
 * steps (message / wait / goal) that contacts are enrolled into, advanced by
 * a cron-callable `/tick`. `message` steps land on `sabchat_journey_outbox`
 * for a channel dispatcher to drain. Owned by the `sabchat-journeys` crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatJourneyStatus = 'draft' | 'active' | 'paused';
export type SabChatJourneyStepKind = 'message' | 'wait' | 'goal';
export type SabChatJourneyChannel = 'chat' | 'email' | 'sms' | 'push';

export interface SabChatJourneyStep {
  id: string;
  kind: SabChatJourneyStepKind;
  channel?: SabChatJourneyChannel | null;
  text?: string | null;
  waitMinutes?: number | null;
}

export interface SabChatJourney {
  _id: string;
  tenantId: string;
  name: string;
  status: SabChatJourneyStatus;
  steps: SabChatJourneyStep[];
  enrolledCount: number;
  completedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SabChatJourneyRun {
  _id: string;
  tenantId: string;
  journeyId: string;
  contactId?: string;
  status: 'active' | 'completed' | 'failed';
  currentStep: number;
  nextRunAt?: string;
  startedAt: string;
  updatedAt: string;
}

export interface SabChatJourneyOutboxItem {
  _id: string;
  journeyId: string;
  runId: string;
  contactId?: string;
  channel: string;
  text: string;
  status: 'pending' | 'sent';
  createdAt: string;
}

export interface SabChatTickReport {
  advanced: number;
  messagesEnqueued: number;
  completed: number;
}

export const sabchatJourneysApi = {
  create: (body: { name: string; steps?: SabChatJourneyStep[] }) =>
    rustFetch<{ id: string }>('/v1/sabchat/journeys/journeys', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  list: () => rustFetch<{ journeys: SabChatJourney[] }>('/v1/sabchat/journeys/journeys'),

  get: (id: string) =>
    rustFetch<{ journey: SabChatJourney; runs: SabChatJourneyRun[] }>(
      `/v1/sabchat/journeys/journeys/${id}`,
    ),

  update: (
    id: string,
    body: { name?: string; status?: SabChatJourneyStatus; steps?: SabChatJourneyStep[] },
  ) =>
    rustFetch<{ message: string }>(`/v1/sabchat/journeys/journeys/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  remove: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/journeys/journeys/${id}`, { method: 'DELETE' }),

  enroll: (id: string, body: { contactIds?: string[]; tag?: string }) =>
    rustFetch<{ enrolled: number }>(`/v1/sabchat/journeys/journeys/${id}/enroll`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  tick: (body: { limit?: number } = {}) =>
    rustFetch<SabChatTickReport>('/v1/sabchat/journeys/tick', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listOutbox: () =>
    rustFetch<{ items: SabChatJourneyOutboxItem[] }>('/v1/sabchat/journeys/outbox'),

  markOutboxSent: (id: string) =>
    rustFetch<{ message: string }>(`/v1/sabchat/journeys/outbox/${id}/sent`, { method: 'POST' }),
};
