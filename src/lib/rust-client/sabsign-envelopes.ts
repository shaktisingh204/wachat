import 'server-only';

/**
 * SabSign envelopes client — wraps `/v1/sabsign/envelopes`.
 *
 * Public sign-page submission goes through `rustPublicFetch` because the
 * signer is an external party authenticated via a per-signer access
 * token, not a SabNode session.
 */
import { rustFetch, rustPublicFetch } from './fetcher';

export type EnvelopeStatus =
  | 'draft'
  | 'sent'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'voided'
  | 'expired';

export type RoutingOrder = 'sequential' | 'parallel' | 'conditional';

export type AuthMethod = 'email' | 'sms_otp' | 'kba' | 'pin';

export type SignerStatus =
  | 'pending'
  | 'notified'
  | 'viewed'
  | 'completed'
  | 'declined';

export type SabSignFieldType =
  | 'signature'
  | 'initials'
  | 'date'
  | 'text'
  | 'number'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'image'
  | 'file'
  | 'stamp'
  | 'phone';

export interface EnvelopeField {
  id: string;
  recipientRole: string;
  fieldType: SabSignFieldType | string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  defaultValue?: string;
  value?: string;
  options?: string[];
  required?: boolean;
  filledAt?: string;
}

export interface KbaQuestion {
  question: string;
  answerHash: string;
}

export interface EnvelopeSigner {
  id: string;
  role: string;
  name: string;
  email: string;
  phone?: string;
  authMethod: AuthMethod;
  kbaQuestions?: KbaQuestion[];
  pinHash?: string;
  order: number;
  status: SignerStatus;
  accessToken?: string;
  notifiedAt?: string;
  viewedAt?: string;
  completedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RoutingRule {
  fieldId: string;
  op: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'truthy';
  value?: string;
  nextSignerId: string;
}

export interface SabSignEnvelopeDoc {
  _id: string;
  userId?: string;
  name: string;
  subject?: string;
  message?: string;
  docId: string;
  docUrl?: string;
  docName?: string;
  status: EnvelopeStatus;
  routingOrder: RoutingOrder;
  routingRules?: RoutingRule[];
  signers: EnvelopeSigner[];
  fields: EnvelopeField[];
  expiresAt?: string;
  reminderDays?: number;
  completedAt?: string;
  signedDocId?: string;
  auditTrailPdfId?: string;
  bulkBatchId?: string;
  templateId?: string;
  inPerson?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface EnvelopeListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: EnvelopeStatus | 'all';
  templateId?: string;
  bulkBatchId?: string;
}

export interface EnvelopeListResponse {
  items: SabSignEnvelopeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateEnvelopeInput {
  name: string;
  docId: string;
  docUrl?: string;
  docName?: string;
  subject?: string;
  message?: string;
  routingOrder?: RoutingOrder;
  routingRules?: RoutingRule[];
  signers?: EnvelopeSigner[];
  fields?: EnvelopeField[];
  expiresAt?: string;
  reminderDays?: number;
  inPerson?: boolean;
  templateId?: string;
  bulkBatchId?: string;
}

export type UpdateEnvelopeInput = Partial<{
  name: string;
  subject: string;
  message: string;
  routingOrder: RoutingOrder;
  routingRules: RoutingRule[];
  signers: EnvelopeSigner[];
  fields: EnvelopeField[];
  expiresAt: string;
  reminderDays: number;
  status: EnvelopeStatus;
}>;

export interface SignSubmissionInput {
  signerId: string;
  accessToken: string;
  pin?: string;
  otp?: string;
  kbaAnswers?: string[];
  fieldValues?: Array<{ fieldId: string; value: string }>;
  decline?: boolean;
  declineReason?: string;
  /** Captured server-side for the audit trail. */
  ip?: string;
  userAgent?: string;
}

export interface SignSubmissionResponse {
  ok: boolean;
  envelopeStatus: EnvelopeStatus;
  nextSignerId?: string | null;
}

/**
 * Sanitized, signer-scoped envelope returned by the public sign endpoint —
 * access tokens, PIN hashes, and KBA answer hashes are stripped before it
 * leaves the server.
 */
export interface SignViewResponse {
  envelope: SabSignEnvelopeDoc;
  signerId: string;
}

function qs(params?: EnvelopeListParams): string {
  if (!params) return '';
  const u = new URLSearchParams();
  if (params.page != null) u.set('page', String(params.page));
  if (params.limit != null) u.set('limit', String(params.limit));
  if (params.q) u.set('q', params.q);
  if (params.status) u.set('status', params.status);
  if (params.templateId) u.set('templateId', params.templateId);
  if (params.bulkBatchId) u.set('bulkBatchId', params.bulkBatchId);
  const s = u.toString();
  return s ? `?${s}` : '';
}

export const sabsignEnvelopesApi = {
  list: (p?: EnvelopeListParams) =>
    rustFetch<EnvelopeListResponse>(`/v1/sabsign/envelopes${qs(p)}`),
  getById: (id: string) =>
    rustFetch<SabSignEnvelopeDoc>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}`,
    ),
  create: (input: CreateEnvelopeInput) =>
    rustFetch<{ id: string; entity: SabSignEnvelopeDoc }>(
      '/v1/sabsign/envelopes',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: UpdateEnvelopeInput) =>
    rustFetch<SabSignEnvelopeDoc>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  send: (id: string, rotateTokens = false) =>
    rustFetch<SabSignEnvelopeDoc>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}/send`,
      { method: 'POST', body: JSON.stringify({ rotateTokens }) },
    ),
  void: (id: string, reason?: string) =>
    rustFetch<SabSignEnvelopeDoc>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}/void`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  /**
   * Public, signer-scoped envelope view for the sign page. Verifies
   * `(signerId, token)`, marks the signer `viewed`, and returns the
   * sanitized envelope. Uses `rustPublicFetch` (no session).
   */
  signView: (id: string, signerId: string, token: string) =>
    rustPublicFetch<SignViewResponse>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}/sign?signerId=${encodeURIComponent(
        signerId,
      )}&token=${encodeURIComponent(token)}`,
    ),
  /**
   * Public sign-page submission. Uses `rustPublicFetch` since the signer
   * is an external party.
   */
  submit: (id: string, input: SignSubmissionInput) =>
    rustPublicFetch<SignSubmissionResponse>(
      `/v1/sabsign/envelopes/${encodeURIComponent(id)}/submit`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
