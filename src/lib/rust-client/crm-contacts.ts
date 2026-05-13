import 'server-only';

/**
 * CRM Contact client — wraps `/v1/crm/contacts` on the Rust BFF
 * (`docs/ecosystem/CRM_PLAN.md` §6.3 — Phase B entity).
 *
 * Built via the generic `makeCrmClient` factory. Tightly-typed against the
 * Rust `CrmContact` DTO (`rust/crates/crm-contacts/src/types.rs`).
 *
 * Counterpart to the legacy direct-Mongo server actions in
 * `src/app/actions/crm.actions.ts` (`getCrmContacts`, `getCrmContactById`,
 * `addCrmContact`, `deleteCrmContact`). When `USE_RUST_CRM === 'true'` those
 * actions delegate here.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

/* ─── Wire types — mirror crm-contacts::types::CrmContact ─────────────── */

export interface CrmContactNote {
    content: string;
    createdAt: string;
    author: string;
}

export interface CrmContactDoc {
    _id?: string;
    userId: string;

    accountId?: string;

    name: string;
    email: string;

    phone?: string;
    company?: string;
    jobTitle?: string;
    avatarUrl?: string;

    /**
     * TS enum is 'new_lead' | 'contacted' | 'qualified' | 'unqualified' |
     * 'customer' | 'imported'. Rust keeps it free-form so soft-delete
     * ('archived') and any other legacy value round-trips unchanged.
     */
    status?: string;

    leadScore?: number;
    leadSource?: string;
    assignedTo?: string;
    lastActivity?: string;

    notes?: CrmContactNote[];
    tags?: string[];

    linkedinUrl?: string;
    twitterHandle?: string;

    lifecycleStage?: string;
    source?: string;
    owner?: string;

    dateOfBirth?: string;
    timezone?: string;

    createdAt: string;
    updatedAt?: string;
}

/**
 * Subset of `CrmContactDoc` accepted by `POST /v1/crm/contacts`. Mirrors
 * `crm-contacts::dto::CreateContactInput` exactly.
 */
export interface CrmContactCreateInput {
    name: string;
    email: string;
    accountId?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    avatarUrl?: string;
    status?: string;
    leadScore?: number;
    leadSource?: string;
    assignedTo?: string;
    tags?: string[];
    linkedinUrl?: string;
    twitterHandle?: string;
    lifecycleStage?: string;
    source?: string;
    owner?: string;
    dateOfBirth?: string;
    timezone?: string;
}

/**
 * PATCH body — every field optional. Mirrors
 * `crm-contacts::dto::UpdateContactInput`.
 */
export type CrmContactUpdateInput = Partial<CrmContactCreateInput> & {
    status?: string;
};

/* ─── Public API ─────────────────────────────────────────────────────── */

export const contactApi: CrmClient<CrmContactDoc, CrmContactCreateInput> = makeCrmClient<
    CrmContactDoc,
    CrmContactCreateInput
>('/v1/crm/contacts');
