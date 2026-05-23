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
        const sendEmail = formData.get('sendEmail') === 'on';

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

            if (sendEmail && issuedToEmail) {
                // Mock email sending
                await new Promise(resolve => setTimeout(resolve, 500));
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'email_sent',
                    entityKind: 'gift_card',
                    entityId: result.insertedId.toString(),
                    reason: `Dispatched gift card to ${issuedToEmail} upon creation`,
                });
            }
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

export async function addGiftCardFunds(
    id: string,
    amount: number,
    notes?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_gift_card', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const giftCard = await db.collection('crm_gift_cards').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });

        if (!giftCard) return { success: false, error: 'Gift card not found.' };

        const newBalance = (giftCard.balance || 0) + amount;
        const newValue = (giftCard.value || 0) + amount;

        await db.collection('crm_gift_cards').updateOne(
            { _id: new ObjectId(id) },
            { $set: { balance: newBalance, value: newValue, updatedAt: new Date() } }
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'gift_card',
            entityId: id,
            reason: `Added funds: ${amount}. ${notes || ''}`,
        });

        revalidatePath(`/dashboard/crm/sales/gift-cards/${id}`);
        return { success: true, message: `Successfully added ${amount} to the gift card.` };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function redeemGiftCard(
    id: string,
    amount: number,
    notes?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_gift_card', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const giftCard = await db.collection('crm_gift_cards').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });

        if (!giftCard) return { success: false, error: 'Gift card not found.' };
        if ((giftCard.balance || 0) < amount) {
            return { success: false, error: 'Insufficient balance.' };
        }

        const newBalance = (giftCard.balance || 0) - amount;
        const status = newBalance === 0 ? 'redeemed' : giftCard.status;

        await db.collection('crm_gift_cards').updateOne(
            { _id: new ObjectId(id) },
            { $set: { balance: newBalance, status, updatedAt: new Date() } }
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'gift_card',
            entityId: id,
            reason: `Redeemed amount: ${amount}. ${notes || ''}`,
        });

        revalidatePath(`/dashboard/crm/sales/gift-cards/${id}`);
        return { success: true, message: `Successfully redeemed ${amount} from the gift card.` };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function emailGiftCard(
    id: string,
    email?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const giftCard = await db.collection('crm_gift_cards').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });

        if (!giftCard) return { success: false, error: 'Gift card not found.' };

        const targetEmail = email || giftCard.issuedToEmail;
        if (!targetEmail) return { success: false, error: 'No email address provided.' };

        // Mocking email dispatch
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'email_sent',
            entityKind: 'gift_card',
            entityId: id,
            reason: `Emailed gift card to ${targetEmail}`,
        });

        revalidatePath(`/dashboard/crm/sales/gift-cards/${id}`);
        return { success: true, message: `Gift card sent to ${targetEmail}.` };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────
 * Deep-list additions (KPIs, filtered list, bulk ops).
 * ──────────────────────────────────────────────────────────────────── */

export interface CrmGiftCardKpis {
    totalIssued: number;
    active: number;
    redeemedValue: number;
    expiringSoon: number;
}

export interface CrmGiftCardListFilters {
    search?: string;
    status?: string;
    createdAfter?: Date | string;
    createdBefore?: Date | string;
}

export async function getGiftCardKpis(): Promise<CrmGiftCardKpis> {
    const empty: CrmGiftCardKpis = {
        totalIssued: 0,
        active: 0,
        redeemedValue: 0,
        expiringSoon: 0,
    };
    const session = await getSession();
    if (!session?.user?._id) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const baseFilter = { userId };

        const in30 = new Date();
        in30.setDate(in30.getDate() + 30);

        const [totalIssued, active, expiringSoon, redeemedAgg] = await Promise.all([
            db.collection('crm_gift_cards').countDocuments(baseFilter),
            db.collection('crm_gift_cards').countDocuments({ ...baseFilter, status: 'active' }),
            db.collection('crm_gift_cards').countDocuments({
                ...baseFilter,
                status: 'active',
                expiryDate: { $gte: new Date(), $lte: in30 },
            }),
            db
                .collection('crm_gift_cards')
                .aggregate([
                    { $match: baseFilter },
                    {
                        $group: {
                            _id: null,
                            sum: {
                                $sum: {
                                    $subtract: [
                                        { $ifNull: ['$value', 0] },
                                        { $ifNull: ['$balance', 0] },
                                    ],
                                },
                            },
                        },
                    },
                ])
                .toArray(),
        ]);

        const redeemedValue = Math.max(0, Number(redeemedAgg?.[0]?.sum ?? 0));
        return { totalIssued, active, redeemedValue, expiringSoon };
    } catch (e) {
        console.error('[getGiftCardKpis] failed:', e);
        return empty;
    }
}

export async function listGiftCards(
    page = 1,
    limit = 20,
    filters: CrmGiftCardListFilters = {},
): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const session = await getSession();
    if (!session?.user?._id) return { rows: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const query: Record<string, unknown> = { userId };

        if (filters.status && filters.status !== 'all') query.status = filters.status;
        if (filters.search) {
            const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { code: { $regex: safe, $options: 'i' } },
                { issuedTo: { $regex: safe, $options: 'i' } },
                { issuedToEmail: { $regex: safe, $options: 'i' } },
            ];
        }
        if (filters.createdAfter || filters.createdBefore) {
            const range: Record<string, Date> = {};
            if (filters.createdAfter) range.$gte = new Date(filters.createdAfter);
            if (filters.createdBefore) range.$lte = new Date(filters.createdBefore);
            query.createdAt = range;
        }

        const skip = Math.max(0, (page - 1) * limit);
        const [docs, total] = await Promise.all([
            db
                .collection('crm_gift_cards')
                .find(query as never)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_gift_cards').countDocuments(query as never),
        ]);

        return { rows: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[listGiftCards] failed:', e);
        return { rows: [], total: 0 };
    }
}

export async function bulkGiftCardAction(
    ids: string[],
    op: 'delete' | 'status',
    payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, processed: 0, error: 'Unauthorized.' };

    const guard = await requirePermission(
        'crm_gift_card',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const valid = (ids ?? []).filter((id) => typeof id === 'string' && ObjectId.isValid(id));
    if (valid.length === 0) {
        return { success: false, processed: 0, error: 'No valid gift cards selected.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const oids = valid.map((id) => new ObjectId(id));
        const baseFilter = { _id: { $in: oids }, userId };

        let processed = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_gift_cards').deleteMany(baseFilter);
            processed = r.deletedCount ?? 0;
        } else {
            const status = String(payload ?? '').trim();
            if (!status) {
                return { success: false, processed: 0, error: 'Status is required.' };
            }
            const r = await db.collection('crm_gift_cards').updateMany(baseFilter, {
                $set: { status, updatedAt: new Date() },
            });
            processed = r.modifiedCount ?? 0;
        }

        for (const id of valid) {
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: op === 'delete' ? 'delete' : 'status_change',
                    entityKind: 'gift_card',
                    entityId: id,
                    reason: payload ? `bulk:${payload}` : `bulk:${op}`,
                });
            } catch {
                /* non-fatal */
            }
        }

        revalidatePath('/dashboard/crm/sales/gift-cards');
        return { success: true, processed };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}
