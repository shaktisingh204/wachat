import 'server-only';

/**
 * SabMeet — Participants client. Wraps `/v1/sabmeet/participants`.
 *
 * One row per join session. POST to join; POST `/:id/leave` on leave.
 */
import { rustFetch } from './fetcher';
import type { CrmListResult } from './crm-base';

export type SabmeetParticipantRole = 'host' | 'cohost' | 'participant' | 'viewer';

export interface SabmeetParticipantDoc {
  _id: string;
  userId: string;
  roomId: string;
  participantUserId?: string;
  guestEmail?: string;
  displayName: string;
  role: SabmeetParticipantRole;
  joinedAt: string;
  leftAt?: string;
  durationSecs?: number;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SabmeetParticipantJoinInput {
  roomId: string;
  displayName: string;
  participantUserId?: string;
  guestEmail?: string;
  role?: SabmeetParticipantRole;
  ip?: string;
  userAgent?: string;
}

export interface SabmeetParticipantListParams {
  roomId?: string;
  state?: 'active' | 'all';
  page?: number;
  limit?: number;
}

function buildQuery(params?: SabmeetParticipantListParams): string {
  const sp = new URLSearchParams();
  if (params?.roomId) sp.set('roomId', params.roomId);
  if (params?.state) sp.set('state', params.state);
  if (typeof params?.page === 'number') sp.set('page', String(params.page));
  if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabmeetParticipantsClient = {
  async list(params?: SabmeetParticipantListParams): Promise<CrmListResult<SabmeetParticipantDoc>> {
    const raw = await rustFetch<{ items: SabmeetParticipantDoc[]; page: number; limit: number; hasMore: boolean }>(
      `/v1/sabmeet/participants${buildQuery(params)}`,
    );
    return {
      items: raw.items ?? [],
      page: raw.page ?? 0,
      limit: raw.limit ?? 20,
      hasMore: raw.hasMore ?? false,
    };
  },
  async join(input: SabmeetParticipantJoinInput): Promise<{ id: string; entity: SabmeetParticipantDoc }> {
    return rustFetch('/v1/sabmeet/participants', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async leave(participantId: string, leftAt?: string): Promise<SabmeetParticipantDoc> {
    return rustFetch(`/v1/sabmeet/participants/${encodeURIComponent(participantId)}/leave`, {
      method: 'POST',
      body: JSON.stringify({ leftAt }),
    });
  },
};
