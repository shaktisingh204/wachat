import 'server-only';

/**
 * CRM Account client — wraps `/v1/crm/accounts` on the Rust BFF
 * (`docs/ecosystem/CRM_PLAN.md` §6.2 — Phase B reference entity).
 *
 * Built via the generic `makeCrmClient` factory. Tightly-typed against the
 * Rust `CrmAccount` DTO (`rust/crates/crm-accounts/src/types.rs`).
 *
 * Counterpart to the legacy direct-Mongo server actions in
 * `src/app/actions/crm-accounts.actions.ts`. When `USE_RUST_CRM === 'true'`
 * those actions delegate here.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

/* ─── Wire types — mirror crm-accounts::types::CrmAccount ─────────────── */

export interface CrmAccountNote {
    content: string;
    createdAt: string;
    author: string;
}

export interface CrmAccountDoc {
    _id?: string;
    userId: string;
    name: string;

    industry?: string;
    website?: string;
    phone?: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;

    gstin?: string;
    pan?: string;
    billingAddress?: string;
    shippingAddress?: string;
    annualRevenue?: number;
    employeeCount?: number;
    currency?: string;
    paymentTerms?: string;
    category?: string;

    contactIds?: string[];
    dealIds?: string[];

    logoUrl?: string;
    attachments?: string[];
    notes?: CrmAccountNote[];

    createdAt: string;
    updatedAt?: string;
    status?: string;
}

/**
 * Subset of `CrmAccountDoc` accepted by `POST /v1/crm/accounts`. Mirrors
 * `crm-accounts::dto::CreateAccountInput` exactly.
 */
export interface CrmAccountCreateInput {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;
    gstin?: string;
    pan?: string;
    billingAddress?: string;
    shippingAddress?: string;
    annualRevenue?: number;
    employeeCount?: number;
    currency?: string;
    paymentTerms?: string;
    category?: string;
    logoUrl?: string;
    attachments?: string[];
}

/**
 * PATCH body — every field optional. Mirrors
 * `crm-accounts::dto::UpdateAccountInput`.
 */
export type CrmAccountUpdateInput = Partial<CrmAccountCreateInput> & {
    status?: 'active' | 'archived';
};

/* ─── Public API ─────────────────────────────────────────────────────── */

export const accountApi: CrmClient<CrmAccountDoc, CrmAccountCreateInput> = makeCrmClient<
    CrmAccountDoc,
    CrmAccountCreateInput
>('/v1/crm/accounts');
