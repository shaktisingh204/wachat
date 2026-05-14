'use server';

/**
 * Stock-adjustment write actions split out of `crm-inventory.actions.ts`
 * to keep both files under the §1D 600-line per-file cap.
 *
 * Houses the `saveCrmStockAdjustment` server action, including the
 * multi-line FormData parser and atomic inventory mutation transaction.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
    CrmStockAdjustment,
    CrmStockAdjustmentLine,
    CrmStockAdjustmentStatus,
} from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

/** Parse `lines[i][key]` FormData entries into a stable array. */
function parseLinesFromFormData(formData: FormData): CrmStockAdjustmentLine[] {
    const grouped = new Map<number, Record<string, string>>();
    formData.forEach((value, key) => {
        const m = key.match(/^lines\[(\d+)\]\[(\w+)\]$/);
        if (!m) return;
        const idx = Number(m[1]);
        const field = m[2];
        if (!grouped.has(idx)) grouped.set(idx, {});
        grouped.get(idx)![field] = String(value);
    });

    const lines: CrmStockAdjustmentLine[] = [];
    for (const [, row] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
        if (!row.productId || !ObjectId.isValid(row.productId)) continue;
        const qtyBefore = row.qtyBefore ? Number(row.qtyBefore) : 0;
        const qtyAfter = row.qtyAfter ? Number(row.qtyAfter) : 0;
        const cost = row.costPerUnit ? Number(row.costPerUnit) : 0;
        lines.push({
            productId: new ObjectId(row.productId),
            qtyBefore: Number.isFinite(qtyBefore) ? qtyBefore : 0,
            qtyAfter: Number.isFinite(qtyAfter) ? qtyAfter : 0,
            delta:
                Number.isFinite(qtyAfter - qtyBefore) ? qtyAfter - qtyBefore : 0,
            batch: row.batch || undefined,
            serial: row.serial || undefined,
            costPerUnit: Number.isFinite(cost) ? cost : undefined,
        });
    }
    return lines;
}

async function nextAdjustmentNumber(
    db: import('mongodb').Db,
    userId: ObjectId,
): Promise<string> {
    try {
        const count = await db
            .collection('crm_stock_adjustments')
            .countDocuments({ userId });
        return `ADJ-${String(count + 1).padStart(4, '0')}`;
    } catch {
        return `ADJ-${Date.now().toString(36).toUpperCase()}`;
    }
}

export async function saveCrmStockAdjustment(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; adjustmentId?: string }> {
    const session = await getSession();
    if (!session?.user)
        return { error: 'Access denied or project not found.' };

    try {
        const userId = new ObjectId(session.user._id);
        const { db } = await connectToDatabase();

        const warehouseIdRaw = formData.get('warehouseId') as string;
        if (!warehouseIdRaw || !ObjectId.isValid(warehouseIdRaw)) {
            return { error: 'Warehouse is required.' };
        }
        const reason = formData.get('reason') as CrmStockAdjustment['reason'];
        if (!reason) return { error: 'Reason is required.' };

        const dateRaw = formData.get('date') as string | null;
        const date = dateRaw ? new Date(dateRaw) : new Date();

        const lines = parseLinesFromFormData(formData);
        const productIdRaw = formData.get('productId') as string | null;
        const quantityRaw = formData.get('quantity') as string | null;

        // Single-row mode requires (productId, quantity); multi-line mode
        // requires at least one parsed line.
        const isMultiLine = lines.length > 0;
        if (!isMultiLine) {
            if (!productIdRaw || !ObjectId.isValid(productIdRaw)) {
                return { error: 'Product is required.' };
            }
            const quantity =
                quantityRaw == null ? NaN : parseInt(quantityRaw, 10);
            if (!Number.isFinite(quantity)) {
                return { error: 'Quantity is required.' };
            }

            const adjustmentNumber = await nextAdjustmentNumber(db, userId);
            const adjustmentData = {
                userId,
                adjustmentNumber,
                productId: new ObjectId(productIdRaw),
                warehouseId: new ObjectId(warehouseIdRaw),
                date,
                quantity,
                reason,
                referenceNumber:
                    (formData.get('referenceNumber') as string | null) ||
                    undefined,
                costPerUnit: formData.get('costPerUnit')
                    ? Number(formData.get('costPerUnit'))
                    : undefined,
                notes: (formData.get('notes') as string | null) || undefined,
                status: 'pending' as CrmStockAdjustmentStatus,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const dbSession = db.client.startSession();
            let insertedId: ObjectId | null = null;
            try {
                await dbSession.withTransaction(async () => {
                    const res = await db
                        .collection('crm_stock_adjustments')
                        .insertOne(adjustmentData as CrmStockAdjustment, {
                            session: dbSession,
                        });
                    insertedId = res.insertedId;
                    const upd = await db.collection('crm_products').updateOne(
                        {
                            _id: adjustmentData.productId,
                            userId,
                            'inventory.warehouseId': adjustmentData.warehouseId,
                        },
                        {
                            $inc: {
                                'inventory.$.stock': adjustmentData.quantity,
                            },
                        },
                        { session: dbSession },
                    );
                    if (upd.matchedCount === 0) {
                        await db.collection('crm_products').updateOne(
                            { _id: adjustmentData.productId, userId },
                            {
                                $push: {
                                    inventory: {
                                        warehouseId: adjustmentData.warehouseId,
                                        stock: adjustmentData.quantity,
                                    },
                                },
                            } as any,
                            { session: dbSession },
                        );
                    }
                });
            } finally {
                await dbSession.endSession();
            }

            if (!insertedId) throw new Error('Failed to persist adjustment.');

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'stock_adjustment',
                entityId: String(insertedId),
                reason: `Created adjustment ${adjustmentNumber}`,
            });

            revalidatePath('/dashboard/crm/inventory/adjustments');
            revalidatePath('/dashboard/crm/products');
            return {
                message: 'Stock adjustment saved successfully!',
                adjustmentId: String(insertedId),
            };
        }

        // Multi-line mode — record the doc with `lines[]` and apply each delta.
        const aggregateQty = lines.reduce(
            (sum, l) => sum + ((l.delta as number) ?? 0),
            0,
        );
        const primaryLine = lines[0];
        const adjustmentNumber = await nextAdjustmentNumber(db, userId);

        const adjustmentData = {
            userId,
            adjustmentNumber,
            // Legacy single-product fields point at the first line so that
            // existing list aggregations keep working.
            productId: primaryLine.productId,
            warehouseId: new ObjectId(warehouseIdRaw),
            date,
            quantity: aggregateQty,
            reason,
            referenceNumber:
                (formData.get('referenceNumber') as string | null) || undefined,
            notes: (formData.get('notes') as string | null) || undefined,
            lines,
            status: 'pending' as CrmStockAdjustmentStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const dbSession = db.client.startSession();
        let insertedId: ObjectId | null = null;
        try {
            await dbSession.withTransaction(async () => {
                const res = await db
                    .collection('crm_stock_adjustments')
                    .insertOne(adjustmentData as CrmStockAdjustment, {
                        session: dbSession,
                    });
                insertedId = res.insertedId;

                for (const line of lines) {
                    const delta = (line.delta as number) ?? 0;
                    if (!delta) continue;
                    const upd = await db.collection('crm_products').updateOne(
                        {
                            _id: line.productId,
                            userId,
                            'inventory.warehouseId': adjustmentData.warehouseId,
                        },
                        { $inc: { 'inventory.$.stock': delta } },
                        { session: dbSession },
                    );
                    if (upd.matchedCount === 0) {
                        await db.collection('crm_products').updateOne(
                            { _id: line.productId, userId },
                            {
                                $push: {
                                    inventory: {
                                        warehouseId: adjustmentData.warehouseId,
                                        stock: delta,
                                    },
                                },
                            } as any,
                            { session: dbSession },
                        );
                    }
                }
            });
        } finally {
            await dbSession.endSession();
        }

        if (!insertedId) throw new Error('Failed to persist adjustment.');

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'stock_adjustment',
            entityId: String(insertedId),
            reason: `Created adjustment ${adjustmentNumber} (${lines.length} lines)`,
        });

        revalidatePath('/dashboard/crm/inventory/adjustments');
        revalidatePath('/dashboard/crm/products');
        return {
            message: 'Stock adjustment saved successfully!',
            adjustmentId: String(insertedId),
        };
    } catch (e) {
        recordRustFallback({ entity: 'stock_adjustment', op: 'create' });
        return { error: getErrorMessage(e) };
    }
}
