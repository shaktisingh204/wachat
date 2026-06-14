import 'server-only';

/**
 * SabCall voice applications client — wraps `/v1/sabcall/applications`.
 *
 * A voice application describes what happens when a call lands: hit a
 * `webhook`, run an `ivr`, drop into a `queue`, `dial` a target, or hand off
 * to the `autopilot` agent. Mirrors the `sabcall-applications` Rust crate's
 * on-disk shape (camelCase; the discriminator serializes under the JSON key
 * `"type"`).
 */
import { rustFetch } from './fetcher';

export type VoiceApplicationType = 'webhook' | 'ivr' | 'queue' | 'dial' | 'autopilot';
export type VoiceApplicationStatus = 'active' | 'disabled';

export interface VoiceApplicationDoc {
  _id: string;
  userId?: string;
  name: string;
  /** Serializes under the JSON key `"type"`. */
  type: VoiceApplicationType;
  webhookUrl?: string;
  ivrId?: string;
  queueId?: string;
  dialTarget?: string;
  fallbackUrl?: string;
  recordCalls: boolean;
  sttEnabled: boolean;
  ttsVoice?: string;
  status: VoiceApplicationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceApplicationListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: VoiceApplicationStatus | 'all';
  type?: VoiceApplicationType;
}

export interface VoiceApplicationListResponse {
  items: VoiceApplicationDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VoiceApplicationCreateInput {
  name: string;
  type: VoiceApplicationType;
  webhookUrl?: string;
  ivrId?: string;
  queueId?: string;
  dialTarget?: string;
  fallbackUrl?: string;
  recordCalls?: boolean;
  sttEnabled?: boolean;
  ttsVoice?: string;
  status?: VoiceApplicationStatus;
}

export type VoiceApplicationUpdateInput = Partial<
  Pick<
    VoiceApplicationCreateInput,
    | 'name'
    | 'type'
    | 'webhookUrl'
    | 'ivrId'
    | 'queueId'
    | 'dialTarget'
    | 'fallbackUrl'
    | 'recordCalls'
    | 'sttEnabled'
    | 'ttsVoice'
    | 'status'
  >
>;

function buildListQuery(p?: VoiceApplicationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.type) qs.set('type', p.type);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcallApplicationsApi = {
  list: (params?: VoiceApplicationListParams) =>
    rustFetch<VoiceApplicationListResponse>(
      `/v1/sabcall/applications${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<VoiceApplicationDoc>(
      `/v1/sabcall/applications/${encodeURIComponent(id)}`,
    ),
  create: (input: VoiceApplicationCreateInput) =>
    rustFetch<{ id: string; entity: VoiceApplicationDoc }>(
      '/v1/sabcall/applications',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  update: (id: string, patch: VoiceApplicationUpdateInput) =>
    rustFetch<VoiceApplicationDoc>(
      `/v1/sabcall/applications/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcall/applications/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
