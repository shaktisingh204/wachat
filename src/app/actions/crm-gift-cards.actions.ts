'use server';

/**
 * CRM Gift Card server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/gift-cards` on the Rust BFF; otherwise legacy
 * direct-Mongo runs. Failures record via `recordRustFallback` and fall
 * through to the legacy path.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmGiftCardsApi } from '@/lib/rust-client/crm-gift-cards';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getGiftCardById(
    giftCardId: string,
): Promise<Record<string, any> | null> {
    if (!giftCardId || !ObjectId.isValid(giftCardId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmGiftCardsApi.getById(giftCardId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getGiftCardById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'gift_card',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_gift_cards').findOne({
            _id: new ObjectId(giftCardId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('getGiftCardById error:', e);
        return null;
    }
}

export async function updateGiftCard(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_gift_card', 'edit');
    if (!guard.ok) return { error: guard.error };

    const giftCardId = (formData.get('giftCardId') as string | null) || '';
    if (!giftCardId || !ObjectId.isValid(giftCardId)) {
        return { error: 'Invalid gift card id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const issuedTo = (formData.get('issuedTo') as string | null)?.trim() || undefined;
        const issuedToEmail = (formData.get('issuedToEmail') as string | null)?.trim() || undefined;
        const notes = (formData.get('notes') as string | null)?.trim() || undefined;
        const transferable = formData.get('transferable') === 'on';
        const expiryDateRaw = formData.get('expiryDate') as string | null;
        const status = (formData.get('status') as string | null) || undefined;

        const $set: Record<string, any> = {
            transferable,
            updatedAt: new Date(),
        };
        if (issuedTo !== undefined) $set.issuedTo = issuedTo;
        if (issuedToEmail !== undefined) $set.issuedToEmail = issuedToEmail;
        if (notes !== undefined) $set.notes = notes;
        if (status) $set.status = status;
        if (expiryDateRaw) {
            const d = new Date(expiryDateRaw);
            if (!isNaN(d.getTime())) $set.expiryDate = d;
        }

        const result = await db.collection('crm_gift_cards').updateOne(
            { _id: new ObjectId(giftCardId), userId: userObjectId },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Gift card not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'gift_card',
                entityId: giftCardId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/gift-cards');
        revalidatePath(`/dashboard/crm/sales/gift-cards/${giftCardId}`);
        return { message: 'Gift card updated successfully.', id: giftCardId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveGiftCard(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_gift_card', 'create');
    if (!guard.ok) return { error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const rawCode = (formData.get('code') as string | null)?.trim().toUpperCase() || '';
        const code = rawCode || `GC-${Date.now().toString().slice(-8)}`;

        const valueRaw = parseFloat(formData.get('value') as string);
        if (!valueRaw || isNaN(valueRaw) || valueRaw <= 0) {
            return { error: 'Value is required and must be a positive number.' };
        }

        const issuedTo = (formData.get('issuedTo') as string | null)?.trim() || undefined;
        const issuedToEmail = (formData.get('issuedToEmail') as string | null)?.trim() || undefined;
        const notesRaw = (formData.get('notes') as string | null)?.trim() || undefined;
        const transferable = formData.get('transferable') === 'on';

        const expiryDateRaw = formData.get('expiryDate') as string | null;
        const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : undefined;

        const now = new Date();

        const doc: Record<string, any> = {
            userId: userObjectId,
            code,
            value: valueRaw,
            balance: valueRaw,
            status: 'active',
            transferable,
            createdAt: now,
            updatedAt: now,
        };

        if (issuedTo) doc.issuedTo = issuedTo;
        if (issuedToEmail) doc.issuedToEmail = issuedToEmail;
        if (expiryDate && !isNaN(expiryDate.getTime())) doc.expiryDate = expiryDate;
        if (notesRaw) doc.notes = notesRaw;

        const result = await db.collection('crm_gift_cards').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'gift_card',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/gift-cards');
        return {
            message: `Gift card ${code} created successfully.`,
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
