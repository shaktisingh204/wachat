'use server';

/**
 * Wachat contact-merge server action — thin shim over the Rust crate
 * `wachat-contact-merge` (mounted at `/v1/wachat/contact-merge`).
 *
 * The Rust handler owns the destructive field-level merge: union of non-null
 * fields (primary wins), re-pointing every `incoming_messages` /
 * `outgoing_messages` FK, dropping the secondary's stale `conversations` rows,
 * then deleting the secondary contact. It is guarded by owner-or-agent project
 * membership. This action only:
 *
 *   1. enforces the Next.js session,
 *   2. validates the three ids,
 *   3. delegates to the namespace,
 *   4. revalidates the affected wachat paths.
 *
 * The client module is imported DIRECTLY (not via the `rustClient` barrel) so
 * this crate doesn't have to touch `@/lib/rust-client/index.ts`.
 */

import { revalidatePath } from 'next/cache';

import { wachatContactMergeApi } from '@/lib/rust-client/wachat-contact-merge';
import type { MergedContact } from '@/lib/rust-client/wachat-contact-merge';
import { getErrorMessage } from '@/lib/utils';
import { getSession } from '@/app/actions/user.actions';

export interface MergeContactsResult {
    success: boolean;
    /** The merged primary contact on success. */
    contact?: MergedContact;
    /** Number of `incoming_messages` rows re-pointed to the primary. */
    incomingRepointed?: number;
    /** Number of `outgoing_messages` rows re-pointed to the primary. */
    outgoingRepointed?: number;
    /** Number of stale `conversations` rows removed for the secondary. */
    conversationsRemoved?: number;
    error?: string;
}

/**
 * Merge the `secondaryId` contact into the `primaryId` contact within one
 * project. Destructive — the secondary contact is deleted by the Rust side.
 */
export async function mergeContacts(
    projectId: string,
    primaryId: string,
    secondaryId: string,
): Promise<MergeContactsResult> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!projectId || !primaryId || !secondaryId) {
        return {
            success: false,
            error: 'projectId, primaryId, and secondaryId are required.',
        };
    }
    if (primaryId === secondaryId) {
        return {
            success: false,
            error: 'Primary and secondary must be different contacts.',
        };
    }

    try {
        const r = await wachatContactMergeApi.merge({
            projectId,
            primaryId,
            secondaryId,
        });

        // The materialised conversation view changed (secondary's rows dropped,
        // primary now owns the re-pointed messages) — revalidate the surfaces
        // that read it.
        revalidatePath('/wachat/contact-merge');
        revalidatePath('/wachat/contacts');
        revalidatePath('/wachat/chat');

        return {
            success: r.success,
            contact: r.contact,
            incomingRepointed: r.incomingRepointed,
            outgoingRepointed: r.outgoingRepointed,
            conversationsRemoved: r.conversationsRemoved,
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
