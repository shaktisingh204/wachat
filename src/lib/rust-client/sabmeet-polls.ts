import 'server-only';

/**
 * SabMeet — Polls client. Wraps `/v1/sabmeet/polls`.
 */
import { rustFetch } from './fetcher';
import type { CrmListResult } from './crm-base';

export interface SabmeetPollOption {
  id: string;
  label: string;
  voters?: string[];
  voteCount?: number;
}

export interface SabmeetPollDoc {
  _id: string;
  userId: string;
  roomId: string;
  question: string;
  options: SabmeetPollOption[];
  multiSelect?: boolean;
  anonymous?: boolean;
  status: 'draft' | 'open' | 'closed';
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetPollCreateInput {
  roomId: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
  anonymous?: boolean;
}

export interface SabmeetPollVoteInput {
  optionIds: string[];
  voter: string;
}

export interface SabmeetPollListParams {
  roomId?: string;
  status?: SabmeetPollDoc['status'];
  page?: number;
  limit?: number;
}

function buildQuery(params?: SabmeetPollListParams): string {
  const sp = new URLSearchParams();
  if (params?.roomId) sp.set('roomId', params.roomId);
  if (params?.status) sp.set('status', params.status);
  if (typeof params?.page === 'number') sp.set('page', String(params.page));
  if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabmeetPollsClient = {
  async list(params?: SabmeetPollListParams): Promise<CrmListResult<SabmeetPollDoc>> {
    const raw = await rustFetch<{ items: SabmeetPollDoc[]; page: number; limit: number; hasMore: boolean }>(
      `/v1/sabmeet/polls${buildQuery(params)}`,
    );
    return {
      items: raw.items ?? [],
      page: raw.page ?? 0,
      limit: raw.limit ?? 20,
      hasMore: raw.hasMore ?? false,
    };
  },
  async create(input: SabmeetPollCreateInput): Promise<{ id: string; entity: SabmeetPollDoc }> {
    return rustFetch('/v1/sabmeet/polls', { method: 'POST', body: JSON.stringify(input) });
  },
  async vote(pollId: string, input: SabmeetPollVoteInput): Promise<SabmeetPollDoc> {
    return rustFetch(`/v1/sabmeet/polls/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async close(pollId: string): Promise<SabmeetPollDoc> {
    return rustFetch(`/v1/sabmeet/polls/${encodeURIComponent(pollId)}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};
