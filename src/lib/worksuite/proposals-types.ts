/**
 * Worksuite Proposals & Estimate Requests types.
 *
 * Ported from Worksuite PHP models:
 *   - Proposal, ProposalItem, ProposalSign, ProposalTemplate, ProposalTemplateItem
 *   - EstimateRequest, AcceptEstimate, EstimateTemplate, EstimateTemplateItem
 *
 * All documents are tenant-scoped via `userId` and persisted as
 * MongoDB documents in collections like `crm_proposals`, etc.
 *
 * Dates are stored as Date in Mongo and surfaced as ISO strings to
 * the client — hence every date field accepts both `string` and
 * `Date` here.
 */

export type WsDateLike = string | Date;

/* ── Proposals ────────────────────────────────────────────────── */

export type WsProposalStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface WsProposal {
  _id?: string;
  userId?: string;
  proposal_number: string;
  /** Client account id (preferred). */
  client_id?: string;
  /** Optional lead id if the proposal targets a lead instead of client. */
  lead_id?: string;
  title: string;
  issue_date?: WsDateLike;
  valid_until?: WsDateLike;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: WsProposalStatus;
  note?: string;
  terms?: string;
  signature_required: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsProposalItem {
  _id?: string;
  userId?: string;
  proposal_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax: number;
  total: number;
  /** Optional image URLs associated with the line item. */
  images?: string[];
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsProposalSign {
  _id?: string;
  userId?: string;
  proposal_id: string;
  signer_name: string;
  signer_email: string;
  signed_at: WsDateLike;
  signature_data_url: string;
  ip_address?: string;
  createdAt?: WsDateLike;
}

/* ── Proposal Templates ──────────────────────────────────────── */

export interface WsProposalTemplate {
  _id?: string;
  userId?: string;
  name: string;
  title: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  note?: string;
  terms?: string;
  signature_required: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsProposalTemplateItem {
  _id?: string;
  userId?: string;
  template_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax: number;
  total: number;
  images?: string[];
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ── Estimate Requests ───────────────────────────────────────── */

export type WsEstimateRequestStatus =
  | 'pending'
  | 'in-review'
  | 'quoted'
  | 'declined';

export interface WsEstimateRequest {
  _id?: string;
  userId?: string;
  client_id?: string;
  /** Requester email if the form was submitted externally. */
  requester_name?: string;
  requester_email?: string;
  description: string;
  desired_date?: WsDateLike;
  status: WsEstimateRequestStatus;
  notes?: string;
  /** When converted into a quote, the id of the created quote/estimate. */
  converted_quote_id?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsAcceptEstimate {
  _id?: string;
  userId?: string;
  estimate_id: string;
  accepted_by_name: string;
  accepted_by_email: string;
  accepted_at: WsDateLike;
  signature_data_url: string;
  ip_address?: string;
  createdAt?: WsDateLike;
}

/* ── Estimate Templates ──────────────────────────────────────── */

export interface WsEstimateTemplate {
  _id?: string;
  userId?: string;
  name: string;
  title: string;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  note?: string;
  terms?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsEstimateTemplateItem {
  _id?: string;
  userId?: string;
  template_id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax: number;
  total: number;
  images?: string[];
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ── Input payloads ──────────────────────────────────────────── */

export interface WsProposalLineInput {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  tax?: number;
}

export interface WsSignPayload {
  name: string;
  email: string;
  signatureDataUrl: string;
}

export const WS_PROPOSAL_STATUSES: WsProposalStatus[] = [
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
];

export const WS_ESTIMATE_REQUEST_STATUSES: WsEstimateRequestStatus[] = [
  'pending',
  'in-review',
  'quoted',
  'declined',
];
