'use server';

/**
 * SabFiles document-security (governance) server actions.
 *
 * Governance — password, expiry, access window, download/view limits, watermark,
 * and the access audit trail — rides the share-link model: configure it via
 * `createShare` (extended fields in `@/app/actions/sabfiles.actions`) and read the
 * resulting access log here. Enforcement lives in the Rust public
 * `/v1/sabfiles/share/{token}*` routes, which gate access and append audit rows.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';
import { getSession } from '@/app/actions/user.actions';
import type { SabfilesAuditEntry } from '@/lib/rust-client/sabfiles';

function asError(e: unknown): { error: string } {
    if (e instanceof RustApiError) return { error: e.message };
    if (e instanceof Error) return { error: e.message };
    return { error: 'Unknown error' };
}

/** Read the access audit trail for a node (owner only). Newest first. */
export async function getNodeAudit(
    id: string,
): Promise<{ entries: SabfilesAuditEntry[] } | { error: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };
    try {
        return await rustClient.sabfiles.nodeAudit(id);
    } catch (e) {
        return asError(e);
    }
}
