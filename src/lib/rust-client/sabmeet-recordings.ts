import 'server-only';

/**
 * SabMeet — Recordings client. Wraps `/v1/sabmeet/recordings`.
 *
 * Recording sessions are SabFiles-backed — the `fileId` field points to a
 * SabFile that owns the encoded media. Never paste an external URL.
 */
import { rustFetch } from './fetcher';
import type { CrmListResult } from './crm-base';

export type SabmeetRecordingStatus = 'recording' | 'processing' | 'ready' | 'failed';

export interface SabmeetTranscriptCue {
  startSec: number;
  endSec: number;
  speaker?: string;
  text: string;
}

export interface SabmeetRecordingDoc {
  _id: string;
  userId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  durationSecs?: number;
  fileId?: string;
  audioFileId?: string;
  transcriptFileId?: string;
  transcript?: SabmeetTranscriptCue[];
  status: SabmeetRecordingStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetRecordingStartInput {
  roomId: string;
}

export interface SabmeetRecordingCompleteInput {
  fileId: string;
  audioFileId?: string;
  transcriptFileId?: string;
  transcript?: SabmeetTranscriptCue[];
  durationSecs?: number;
}

export interface SabmeetRecordingListParams {
  roomId?: string;
  status?: SabmeetRecordingStatus;
  page?: number;
  limit?: number;
}

function buildQuery(params?: SabmeetRecordingListParams): string {
  const sp = new URLSearchParams();
  if (params?.roomId) sp.set('roomId', params.roomId);
  if (params?.status) sp.set('status', params.status);
  if (typeof params?.page === 'number') sp.set('page', String(params.page));
  if (typeof params?.limit === 'number') sp.set('limit', String(params.limit));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabmeetRecordingsClient = {
  async list(params?: SabmeetRecordingListParams): Promise<CrmListResult<SabmeetRecordingDoc>> {
    const raw = await rustFetch<{ items: SabmeetRecordingDoc[]; page: number; limit: number; hasMore: boolean }>(
      `/v1/sabmeet/recordings${buildQuery(params)}`,
    );
    return {
      items: raw.items ?? [],
      page: raw.page ?? 0,
      limit: raw.limit ?? 20,
      hasMore: raw.hasMore ?? false,
    };
  },
  async start(input: SabmeetRecordingStartInput): Promise<{ id: string; entity: SabmeetRecordingDoc }> {
    return rustFetch('/v1/sabmeet/recordings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async complete(recordingId: string, input: SabmeetRecordingCompleteInput): Promise<SabmeetRecordingDoc> {
    return rustFetch(`/v1/sabmeet/recordings/${encodeURIComponent(recordingId)}/complete`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async fail(recordingId: string, errorMessage: string): Promise<SabmeetRecordingDoc> {
    return rustFetch(`/v1/sabmeet/recordings/${encodeURIComponent(recordingId)}/fail`, {
      method: 'POST',
      body: JSON.stringify({ errorMessage }),
    });
  },
  async delete(recordingId: string): Promise<{ deleted: boolean }> {
    return rustFetch(`/v1/sabmeet/recordings/${encodeURIComponent(recordingId)}`, {
      method: 'DELETE',
    });
  },
};
