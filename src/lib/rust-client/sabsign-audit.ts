import 'server-only';

/**
 * SabSign audit log client — wraps `/v1/sabsign/audit`.
 */
import { rustFetch } from './fetcher';

export interface SabSignAuditEvent {
  _id?: string;
  envelopeId: string;
  userId: string;
  signerId?: string;
  eventType: string;
  ts: string;
  ip?: string;
  data?: unknown;
  hash: string;
}

export interface AuditListResponse {
  items: SabSignAuditEvent[];
  chainValid: boolean;
}

export const sabsignAuditApi = {
  list: (params?: { envelopeId?: string; eventType?: string; limit?: number }) => {
    const u = new URLSearchParams();
    if (params?.envelopeId) u.set('envelopeId', params.envelopeId);
    if (params?.eventType) u.set('eventType', params.eventType);
    if (params?.limit != null) u.set('limit', String(params.limit));
    const s = u.toString();
    return rustFetch<AuditListResponse>(`/v1/sabsign/audit${s ? `?${s}` : ''}`);
  },
};
