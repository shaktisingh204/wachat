'use server';

/**
 * SabBigin company helpers that the full-CRM account actions don't cover.
 *
 * `updateCrmAccount` persists the editable text fields but NOT the SabFiles
 * attachment list. SabBigin's company detail surface lets a user attach
 * files from their SabFiles library, so we persist that array here with a
 * lean, direct-Mongo write scoped by `userId`. All attachment URLs come from
 * SabFiles — there is no free-text URL paste.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

export interface UpdateAttachmentsResult {
    ok: boolean;
    error?: string;
    attachments?: string[];
}

/**
 * Replace a company's SabFiles attachment list. The caller passes the full,
 * already-reconciled array (add/remove happen client-side, then we persist
 * the whole list). URLs are expected to originate from SabFiles.
 */
export async function updateCompanyAttachments(
    companyId: string,
    attachments: string[],
): Promise<UpdateAttachmentsResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    if (!companyId || !ObjectId.isValid(companyId)) {
        return { ok: false, error: 'Invalid company id.' };
    }

    // Defensive: keep only non-empty strings, dedupe, cap to a sane count.
    const clean = Array.from(
        new Set((attachments ?? []).filter((u) => typeof u === 'string' && u.trim() !== '')),
    ).slice(0, 100);

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            {
                _id: new ObjectId(companyId),
                userId: new ObjectId(session.user._id),
            },
            { $set: { attachments: clean, updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { ok: false, error: 'Company not found.' };
        }

        revalidatePath(`/dashboard/sabbigin/companies/${companyId}`);
        return { ok: true, attachments: clean };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
