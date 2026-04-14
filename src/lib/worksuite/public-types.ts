import type { ObjectId } from 'mongodb';

/**
 * Worksuite public-portal types.
 *
 * These types back the customer-facing portal under `/p/*` — pages
 * that leads/clients reach without authenticating (paying an invoice,
 * signing a proposal, accepting an estimate, submitting a form,
 * granting GDPR consent).
 *
 * Every record is tenant-scoped via `userId`. The public actions
 * resolve the tenant from a token record or a form record — they
 * never call `requireSession()`.
 *
 * Collections:
 *   crm_public_tokens, crm_public_submissions.
 */

export type WsPublicResourceType =
  | 'proposal'
  | 'estimate'
  | 'invoice'
  | 'contract';

export interface WsPublicAccessToken {
  _id?: ObjectId | string;
  /** Tenant that created the token (resolved from the resource). */
  userId: ObjectId | string;
  resource_type: WsPublicResourceType;
  resource_id: ObjectId | string;
  /** Opaque random token embedded in the public URL. */
  token: string;
  /** Optional expiry — undefined = never expires. */
  expires_at?: Date | string;
  /** Optional cap on # of resolves allowed. undefined = unlimited. */
  uses_allowed?: number;
  /** Number of resolves so far. */
  uses_count?: number;
  /** Whether the token has been explicitly revoked. */
  revoked?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type WsPublicFormType = 'lead' | 'ticket';

export interface WsPublicSubmission {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  form_type: WsPublicFormType;
  /** ID of the lead/ticket created from this submission, if any. */
  created_record_id?: ObjectId | string;
  /** Form metadata — raw JSON of the submitted payload. */
  submitted_data: Record<string, unknown>;
  submitter_email?: string;
  submitter_name?: string;
  ip_address?: string;
  user_agent?: string;
  submitted_at: Date | string;
  createdAt?: Date | string;
}
