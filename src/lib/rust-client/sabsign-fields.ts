import 'server-only';

/**
 * SabSign field analytics client — wraps `/v1/sabsign/fields`.
 */
import { rustFetch } from './fetcher';

export interface FieldUsageBucket {
  fieldType: string;
  total: number;
  filled: number;
  unfilled: number;
}

export interface EnvelopeFieldSummary {
  envelopeId: string;
  envelopeName: string;
  status: string;
  totalFields: number;
  filledFields: number;
}

export const sabsignFieldsApi = {
  usage: (status?: string) => {
    const s = status ? `?status=${encodeURIComponent(status)}` : '';
    return rustFetch<{ buckets: FieldUsageBucket[] }>(`/v1/sabsign/fields/usage${s}`);
  },
  perEnvelope: (limit?: number) => {
    const s = limit != null ? `?limit=${limit}` : '';
    return rustFetch<{ items: EnvelopeFieldSummary[] }>(`/v1/sabsign/fields/per-envelope${s}`);
  },
};
