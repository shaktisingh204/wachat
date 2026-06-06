'use server';

/**
 * Server actions for the Wachat **contacts export + sync** feature.
 *
 * Thin shims over the `wachatContactsExportSyncApi` namespace (which wraps
 * the Rust crate mounted at `/v1/wachat/contacts-export-sync`). They back
 * the "Sync Contacts" dialog on `/wachat/contacts`:
 *
 *   - syncContactsFromVcard   → POST /sync/vcard   (local parse + upsert)
 *   - syncContactsFromGoogle  → POST /sync/google  (gated external seam)
 *   - syncContactsFromShopify → POST /sync/shopify (gated external seam)
 *
 * The CSV export (`GET /export`) streams a non-JSON body, so it is consumed
 * directly by the browser via the `/api/wachat/contacts/export` route — not
 * a server action.
 *
 * The two integration syncs degrade to a typed `400 BAD_REQUEST`
 * ("<Provider> not connected") when no credentials are stored; these
 * actions surface that as a friendly `{ notConnected: true }` flag so the
 * page can show a Connect-provider state instead of a hard error toast.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { RustApiError } from '@/lib/rust-client';
import {
    wachatContactsExportSyncApi,
    type IntegrationSyncBody,
} from '@/lib/rust-client/wachat-contacts-export-sync';

/** Shared result shape for every sync action. */
export interface ContactsSyncResult {
    /** Success summary, e.g. "Sync complete. 12 imported/updated. 0 skipped." */
    message?: string;
    /** Rows upserted (present on success). */
    imported?: number;
    /** Rows skipped (present on success). */
    skipped?: number;
    /** Generic failure message. */
    error?: string;
    /**
     * Set when the provider has no stored credentials (Rust `400
     * BAD_REQUEST` "<Provider> not connected"). The UI shows a
     * Connect-provider state instead of an error toast.
     */
    notConnected?: boolean;
}

/**
 * `POST /sync/vcard` — parse a vCard blob (already read to text on the
 * client) and bulk-upsert the contacts it contains.
 */
export async function syncContactsFromVcard(input: {
    projectId: string;
    phoneNumberId: string;
    vcard: string;
}): Promise<ContactsSyncResult> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!input.projectId || !input.phoneNumberId) {
        return { error: 'Project and Phone Number ID are required.' };
    }
    if (!input.vcard.trim()) {
        return { error: 'No vCard data provided.' };
    }

    try {
        const r = await wachatContactsExportSyncApi.syncVcard({
            projectId: input.projectId,
            phoneNumberId: input.phoneNumberId,
            vcard: input.vcard,
        });
        revalidatePath('/wachat/contacts');
        return { message: r.message, imported: r.imported, skipped: r.skipped };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Shared body for the two gated integration syncs. Maps the Rust `400
 * BAD_REQUEST` ("<Provider> not connected") degradation to a
 * `notConnected` flag so the page renders a Connect state gracefully.
 */
async function syncViaIntegration(
    call: (body: IntegrationSyncBody) => Promise<{ message: string; imported: number; skipped: number }>,
    body: IntegrationSyncBody,
): Promise<ContactsSyncResult> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    if (!body.projectId || !body.phoneNumberId) {
        return { error: 'Project and Phone Number ID are required.' };
    }

    try {
        const r = await call(body);
        revalidatePath('/wachat/contacts');
        return { message: r.message, imported: r.imported, skipped: r.skipped };
    } catch (e: unknown) {
        // The external seam degrades to a typed 400 ("<Provider> not
        // connected") whenever no integration credentials exist — surface
        // it as a soft Connect-provider state, not a failure.
        if (e instanceof RustApiError && e.status === 400) {
            return { notConnected: true, error: e.message };
        }
        return { error: getErrorMessage(e) };
    }
}

/** `POST /sync/google` — gated Google Contacts sync. */
export async function syncContactsFromGoogle(
    body: IntegrationSyncBody,
): Promise<ContactsSyncResult> {
    return syncViaIntegration(wachatContactsExportSyncApi.syncGoogle, body);
}

/** `POST /sync/shopify` — gated Shopify Customers sync. */
export async function syncContactsFromShopify(
    body: IntegrationSyncBody,
): Promise<ContactsSyncResult> {
    return syncViaIntegration(wachatContactsExportSyncApi.syncShopify, body);
}
