/**
 * Client for the Facebook Lead Gen router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/lead-gen` by the
 * `wachat-facebook-lead-gen` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ … , error? }` envelopes the
 * legacy TS server actions returned, so calling code does not need to
 * change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/lead-gen';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface FacebookLeadGenForm {
    id: string;
    name: string;
    status: string;
    leads_count?: number;
    created_time: string;
    expired_leads_count?: number;
    page?: { id: string; name: string };
}

export interface FacebookLeadFieldEntry {
    name: string;
    values: string[];
}

export interface FacebookLead {
    id: string;
    created_time: string;
    field_data: FacebookLeadFieldEntry[];
    form_id?: string;
}

export interface LeadGenFormsResp {
    forms?: FacebookLeadGenForm[];
    error?: string;
}

export interface LeadsResp {
    leads?: FacebookLead[];
    error?: string;
}

export interface LeadResp {
    lead?: FacebookLead;
    error?: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookLeadGenApi = {
    /** Legacy: `getLeadGenForms(projectId)`. */
    getLeadGenForms: (projectId: string) =>
        rustFetch<LeadGenFormsResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/forms`,
        ),

    /** Legacy: `getLeadsForForm(formId, projectId)`. */
    getLeadsForForm: (formId: string, projectId: string) =>
        rustFetch<LeadsResp>(
            `${BASE}/forms/${encodeURIComponent(formId)}/leads?projectId=${encodeURIComponent(projectId)}`,
        ),

    /** Legacy: `getLeadById(leadId, projectId)`. */
    getLeadById: (leadId: string, projectId: string) =>
        rustFetch<LeadResp>(
            `${BASE}/leads/${encodeURIComponent(leadId)}?projectId=${encodeURIComponent(projectId)}`,
        ),
};

export type WachatFacebookLeadGenApi = typeof wachatFacebookLeadGenApi;
