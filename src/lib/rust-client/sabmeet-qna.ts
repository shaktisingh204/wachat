import 'server-only';

/**
 * SabMeet — Q&A client. Wraps `/v1/sabmeet/qna`.
 */
import { rustFetch } from './fetcher';
import type { CrmListResult } from './crm-base';

export interface SabmeetQnaDoc {
  _id: string;
  userId: string;
  roomId: string;
  askerName?: string;
  askerUserId?: string;
  question: string;
  answered?: boolean;
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  upvotes?: number;
  upvoters?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetQnaAskInput {
  roomId: string;
  question: string;
  askerName?: string;
  askerUserId?: string;
}

export interface SabmeetQnaListParams {
  roomId?: string;
  state?: 'all' | 'open' | 'answered';
  page?: number;
  limit?: number;
}

function buildQuery(params?: SabmeetQnaListParams): string {
  const sp = new URLSearchParams();
  if (params?.roomId) sp.set('roomId', params.roomId);
  if (params?.state) sp.set('state', params.state);
  if (typeof params?.page === 'number') sp.set('page', String(params.page));
  if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabmeetQnaClient = {
  async list(params?: SabmeetQnaListParams): Promise<CrmListResult<SabmeetQnaDoc>> {
    const raw = await rustFetch<{ items: SabmeetQnaDoc[]; page: number; limit: number; hasMore: boolean }>(
      `/v1/sabmeet/qna${buildQuery(params)}`,
    );
    return {
      items: raw.items ?? [],
      page: raw.page ?? 0,
      limit: raw.limit ?? 20,
      hasMore: raw.hasMore ?? false,
    };
  },
  async ask(input: SabmeetQnaAskInput): Promise<{ id: string; entity: SabmeetQnaDoc }> {
    return rustFetch('/v1/sabmeet/qna', { method: 'POST', body: JSON.stringify(input) });
  },
  async answer(qnaId: string, answer: string): Promise<SabmeetQnaDoc> {
    return rustFetch(`/v1/sabmeet/qna/${encodeURIComponent(qnaId)}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
  },
  async upvote(qnaId: string, voter: string): Promise<SabmeetQnaDoc> {
    return rustFetch(`/v1/sabmeet/qna/${encodeURIComponent(qnaId)}/upvote`, {
      method: 'POST',
      body: JSON.stringify({ voter }),
    });
  },
};
