import 'server-only';

/**
 * SabMeet — Rooms client. Wraps `/v1/sabmeet/rooms`.
 *
 * The SabMeet module's video conference room. Scheduled or instant,
 * supports lobby, recording toggle, passcode, SFU room id placeholder.
 */
import { makeCrmClient, type CrmListParams } from './crm-base';

export interface SabmeetRoomRecurringRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  count?: number;
  until?: string;
  byWeekday?: string[];
}

export interface SabmeetRoomDoc {
  _id: string;
  userId: string;
  name: string;
  hostUserId: string;
  cohostUserIds?: string[];
  inviteeUserIds?: string[];
  inviteeEmails?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  timezone?: string;
  recurringRule?: SabmeetRoomRecurringRule;
  joinCode: string;
  passcode?: string;
  lobbyEnabled?: boolean;
  recordingEnabled?: boolean;
  requireAuth?: boolean;
  sfuRoomId?: string;
  status: 'scheduled' | 'live' | 'ended' | 'canceled';
  description?: string;
  agenda?: string[];
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetRoomCreateInput {
  name: string;
  description?: string;
  agenda?: string[];
  hostUserId?: string;
  cohostUserIds?: string[];
  inviteeUserIds?: string[];
  inviteeEmails?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  timezone?: string;
  recurringRule?: SabmeetRoomRecurringRule;
  passcode?: string;
  lobbyEnabled?: boolean;
  recordingEnabled?: boolean;
  requireAuth?: boolean;
}

export type SabmeetRoomListWhen = 'upcoming' | 'past' | 'live' | 'all';

export interface SabmeetRoomListParams extends CrmListParams {
  when?: SabmeetRoomListWhen;
  status?: SabmeetRoomDoc['status'];
  hostUserId?: string;
}

export const sabmeetRoomsClient = makeCrmClient<SabmeetRoomDoc, SabmeetRoomCreateInput>(
  '/v1/sabmeet/rooms',
);
