import 'server-only';

/**
 * CRM Vendor client — wraps `/v1/crm/vendors` on the Rust BFF.
 *
 * Built via the generic `makeCrmClient` factory. Tightly-typed against the
 * Rust `CrmVendor` DTO (`rust/crates/crm-vendors/src/types.rs`).
 *
 * Counterpart to the legacy direct-Mongo server actions in
 * `src/app/actions/crm-vendors.actions.ts`. When `USE_RUST_CRM === 'true'`
 * those actions delegate here.
 */

import { makeCrmClient, type CrmClient } from './crm-base';

/* ─── Wire types — mirror crm-vendors::types::CrmVendor ───────────────── */

export interface CrmVendorBankDetails {
    accountNumber?: string;
    accountHolder?: string;
    ifsc?: string;
    bankName?: string;
    accountType?: 'current' | 'savings';
    currency?: string;
    swiftCode?: string;
    ibanCode?: string;
}

export interface CrmVendorDoc {
    _id?: string;
    userId: string;
    name: string;

    displayName?: string;
    industry?: string;
    industryId?: string;
    logoUrl?: string;

    email?: string;
    phone?: string;

    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    street?: string;

    gstin?: string;
    pan?: string;
    panName?: string;
    vendorType?: string;
    taxTreatment?: string;
    subject?: string;

    bankAccountDetails?: CrmVendorBankDetails;

    showEmailInInvoice?: boolean;
    showPhoneInInvoice?: boolean;

    attachments?: string[];

    createdAt: string;
    updatedAt?: string;
}

/**
 * Subset of `CrmVendorDoc` accepted by `POST /v1/crm/vendors`. Mirrors
 * `crm-vendors::dto::CreateVendorInput` exactly.
 */
export interface CrmVendorCreateInput {
    name: string;
    displayName?: string;
    industry?: string;
    industryId?: string;
    logoUrl?: string;
    email?: string;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    street?: string;
    gstin?: string;
    pan?: string;
    panName?: string;
    vendorType?: string;
    taxTreatment?: string;
    subject?: string;
    bankAccountDetails?: CrmVendorBankDetails;
    showEmailInInvoice?: boolean;
    showPhoneInInvoice?: boolean;
    attachments?: string[];
}

/**
 * PATCH body — every field optional. Mirrors
 * `crm-vendors::dto::UpdateVendorInput`.
 */
export type CrmVendorUpdateInput = Partial<CrmVendorCreateInput>;

/* ─── Public API ─────────────────────────────────────────────────────── */

export const vendorApi: CrmClient<CrmVendorDoc, CrmVendorCreateInput> = makeCrmClient<
    CrmVendorDoc,
    CrmVendorCreateInput
>('/v1/crm/vendors');
