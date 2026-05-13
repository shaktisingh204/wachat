'use server';

/**
 * CRM Payment Receipt server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, read/save/update delegate to
 *    `/v1/crm/payment-receipts` on the Rust BFF via
 *    `src/lib/rust-client/crm-payment-receipts.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/sales/receipts/**` keep working without changes.
 *
 * Per the Rust DTO contract, financial fields (`amount`, `applyTo`,
 * `mode`, `clientId`, `currency`) are NOT patchable — use void+recreate
 * for amount changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmPaymentReceipt, CrmInvoice, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import {
    crmPaymentReceiptsApi,
    type CrmInvoiceApplication,
    type CrmPaymentMode,
} from '@/lib/rust-client/crm-payment-receipts';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getPaymentReceipts(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ receipts: WithId<CrmPaymentReceipt>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { receipts: [], total: 0 };

    if (useRustCrm()) {
        try {
            const items = await crmPaymentReceiptsApi.list({ page, limit, q: query });
            const arr = Array.isArray(items) ? items : [];
            return {
                receipts: JSON.parse(JSON.stringify(arr)) as WithId<CrmPaymentReceipt>[],
                total: arr.length,
            };
        } catch (e) {
            console.error('[getPaymentReceipts] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'receipt', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [receipts, total] = await Promise.all([
            db.collection('crm_payment_receipts')
                .find(filter)
                .sort({ receiptDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_payment_receipts').countDocuments(filter)
        ]);

        return {
            receipts: JSON.parse(JSON.stringify(receipts)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM payment receipts:", e);
        return { receipts: [], total: 0 };
    }
}

export async function getPaymentReceiptById(id: string): Promise<WithId<CrmPaymentReceipt> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPaymentReceiptsApi.getById(id);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmPaymentReceipt>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.code === 'NOT_FOUND') return null;
            console.error('[getPaymentReceiptById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'receipt', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;

    try {
        const { db } = await connectToDatabase();
        const receipt = await db.collection<CrmPaymentReceipt>('crm_payment_receipts').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return receipt ? JSON.parse(JSON.stringify(receipt)) : null;
    } catch (e) {
        console.error('Failed to fetch payment receipt:', e);
        return null;
    }
}

/**
 * Light-edit action — round-trips only the non-financial fields:
 * bankAccountId, notes, receiptDate. Payment records and invoice
 * settlement stay immutable on edit since reverting them safely
 * would require unwinding paid-amount mutations on linked invoices,
 * which is out of scope for this surface. Use a void+recreate flow
 * for amount changes.
 */
export async function updatePaymentReceipt(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_receipt', 'edit');
    if (!guard.ok) return { error: guard.error };

    const receiptIdRaw = formData.get('receiptId') as string | null;
    if (!receiptIdRaw) {
        return { error: 'Receipt id is required.' };
    }

    if (useRustCrm()) {
        try {
            const bankAccountIdRaw = formData.get('bankAccountId') as string | null;
            const receiptDateRaw = formData.get('receiptDate') as string | null;
            await crmPaymentReceiptsApi.update(receiptIdRaw, {
                notes: (formData.get('notes') as string) ?? '',
                bankAccountId: bankAccountIdRaw || undefined,
                date: receiptDateRaw ? new Date(receiptDateRaw).toISOString() : undefined,
            });
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'paymentReceipt',
                    entityId: receiptIdRaw,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/sales/receipts');
            revalidatePath(`/dashboard/crm/sales/receipts/${receiptIdRaw}/edit`);
            return { message: 'Payment receipt updated successfully.' };
        } catch (e) {
            console.error('[updatePaymentReceipt] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'receipt', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(receiptIdRaw)) {
        return { error: 'Receipt id is required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const bankAccountIdRaw = formData.get('bankAccountId') as string | null;
        const bankAccountId = bankAccountIdRaw && ObjectId.isValid(bankAccountIdRaw)
            ? new ObjectId(bankAccountIdRaw)
            : undefined;

        const receiptDateRaw = formData.get('receiptDate') as string | null;
        const $set: Record<string, unknown> = {
            bankAccountId,
            notes: (formData.get('notes') as string) ?? '',
            updatedAt: new Date(),
        };
        if (receiptDateRaw) {
            $set.receiptDate = new Date(receiptDateRaw);
        }

        const result = await db.collection('crm_payment_receipts').updateOne(
            { _id: new ObjectId(receiptIdRaw), userId: userObjectId },
            { $set }
        );

        if (result.matchedCount === 0) {
            return { error: 'Payment receipt not found or permission denied.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'paymentReceipt',
                entityId: receiptIdRaw,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/receipts');
        revalidatePath(`/dashboard/crm/sales/receipts/${receiptIdRaw}/edit`);
        return { message: 'Payment receipt updated successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePaymentReceipt(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_receipt', 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const paymentRecords = JSON.parse(formData.get('paymentRecords') as string || '[]') as Array<any>;
            const settledInvoicesRaw = JSON.parse(formData.get('settledInvoices') as string || '[]') as Array<any>;
            const totalAmountReceived = paymentRecords.reduce(
                (sum: number, record: any) => sum + Number(record.amount || 0),
                0,
            );

            const applyTo: CrmInvoiceApplication[] = settledInvoicesRaw
                .filter((s: any) => s.invoiceId)
                .map((s: any) => ({
                    invoiceId: String(s.invoiceId),
                    amount: Number(s.amountSettled || 0),
                }));

            const firstRecord = paymentRecords[0] || {};
            const modeMap: Record<string, CrmPaymentMode> = {
                Cash: 'cash',
                Cheque: 'cheque',
                UPI: 'upi',
                NEFT: 'neft',
                RTGS: 'rtgs',
                IMPS: 'imps',
                Card: 'card',
                Wallet: 'wallet',
            };
            const mode: CrmPaymentMode =
                modeMap[firstRecord.method as string] || (firstRecord.method as CrmPaymentMode) || 'cash';

            const dateRaw = (formData.get('receiptDate') as string | null) || '';
            const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();

            const fromKindRaw = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            const created = await crmPaymentReceiptsApi.create({
                receiptNo:
                    (formData.get('receiptNumber') as string | null) ||
                    `PR-${Date.now().toString().slice(-5)}`,
                date,
                clientId: (formData.get('accountId') as string | null) || '',
                mode,
                bankAccountId: (formData.get('bankAccountId') as string | null) || '',
                amount: totalAmountReceived,
                currency: (formData.get('currency') as string | null) || 'INR',
                applyTo,
                notes: (formData.get('notes') as string | null) || undefined,
                fromKind: fromKindRaw as any,
                fromId,
            });

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'paymentReceipt',
                    entityId: (created as any)._id?.toString() || '',
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/receipts');
            revalidatePath('/dashboard/crm/sales/invoices');
            return { message: 'Payment receipt saved successfully.' };
        } catch (e) {
            console.error('[savePaymentReceipt] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'receipt', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const paymentRecords = JSON.parse(formData.get('paymentRecords') as string || '[]');
        const settledInvoices = JSON.parse(formData.get('settledInvoices') as string || '[]');
        const totalAmountReceived = paymentRecords.reduce((sum: number, record: any) => sum + Number(record.amount || 0), 0);

        const newReceiptId = new ObjectId();
        const bankAccountIdRaw = formData.get('bankAccountId') as string | null;
        const bankAccountId = bankAccountIdRaw && ObjectId.isValid(bankAccountIdRaw)
            ? new ObjectId(bankAccountIdRaw)
            : undefined;

        const receiptData: Omit<CrmPaymentReceipt, 'createdAt' | 'updatedAt'> = {
            _id: newReceiptId,
            userId: new ObjectId(session.user._id),
            accountId: new ObjectId(formData.get('accountId') as string),
            receiptNumber: formData.get('receiptNumber') as string,
            receiptDate: new Date(formData.get('receiptDate') as string),
            currency: formData.get('currency') as string,
            totalAmountReceived,
            paymentRecords,
            settledInvoices,
            notes: formData.get('notes') as string,
            bankAccountId,
        };

        if (!receiptData.receiptNumber || !receiptData.accountId || totalAmountReceived <= 0) {
            return { error: 'Receipt number, client, and a valid payment amount are required.' };
        }

        const { db } = await connectToDatabase();

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a receipt is
        // created in the context of a parent doc — typically an
        // Invoice (single-invoice settlement) or a Proforma Invoice
        // (advance-payment receipts). Multi-invoice settlements via
        // `apply_to[]` (settledInvoices) are NOT cross-linked here:
        // lineage points at a single primary parent — explicit
        // `fromKind`/`fromId` if provided, else the first applied
        // invoice from `settledInvoices` if any.
        let lineage: LineageRef[] | undefined;
        let resolvedFromKind: LineageKind | null = null;
        let resolvedFromId: string | null = null;

        const rawFromKind = (formData.get('fromKind') as string | null) || null;
        const rawFromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['invoice', 'proforma'];

        if (rawFromKind && rawFromId && ALLOWED_PARENT_KINDS.includes(rawFromKind as LineageKind) && ObjectId.isValid(rawFromId)) {
            resolvedFromKind = rawFromKind as LineageKind;
            resolvedFromId = rawFromId;
        } else if (settledInvoices.length > 0 && settledInvoices[0]?.invoiceId && ObjectId.isValid(settledInvoices[0].invoiceId)) {
            // Fallback to first applied invoice as primary parent.
            resolvedFromKind = 'invoice';
            resolvedFromId = settledInvoices[0].invoiceId;
        }

        const parentCollection: Record<string, string> = {
            invoice: 'crm_invoices',
            proforma: 'crm_proforma_invoices',
        };
        const parentNoField: Record<string, string> = {
            invoice: 'invoiceNumber',
            proforma: 'proformaNumber',
        };

        if (resolvedFromKind && resolvedFromId) {
            const coll = parentCollection[resolvedFromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(resolvedFromId),
                    userId: new ObjectId(session.user._id),
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: resolvedFromKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[resolvedFromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — receipt still saves
            }
        }

        // Use a transaction to ensure atomicity
        const dbSession = db.client.startSession();
        try {
            await dbSession.withTransaction(async () => {
                // 1. Save the payment receipt
                await db.collection('crm_payment_receipts').insertOne({
                    ...receiptData,
                    ...(lineage ? { lineage } : {}),
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any, { session: dbSession });

                // 2. Update the status of settled invoices
                if (settledInvoices.length > 0) {
                    const invoiceIds = settledInvoices.map((s: any) => new ObjectId(s.invoiceId));
                    const invoicesToUpdate = await db.collection<WithId<CrmInvoice>>('crm_invoices').find({ _id: { $in: invoiceIds } }).toArray();

                    for (const invoice of invoicesToUpdate) {
                        const settlement = settledInvoices.find((s: any) => s.invoiceId === invoice._id.toString());
                        const amountSettled = settlement?.amountSettled || 0;
                        const existingPaidAmount = invoice.paidAmount || 0;
                        const newPaidAmount = existingPaidAmount + amountSettled;

                        let newStatus: CrmInvoice['status'] = 'Partially Paid';
                        if (newPaidAmount >= invoice.total) {
                            newStatus = 'Paid';
                        }

                        await db.collection('crm_invoices').updateOne(
                            { _id: invoice._id },
                            { $set: { status: newStatus, paidAmount: newPaidAmount } },
                            { session: dbSession }
                        );
                    }
                }
            });
        } finally {
            await dbSession.endSession();
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'paymentReceipt',
                entityId: newReceiptId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        // Best-effort back-link onto the primary parent doc.
        if (lineage && resolvedFromKind && resolvedFromId) {
            try {
                const coll = parentCollection[resolvedFromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(resolvedFromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'paymentReceipt',
                    id: newReceiptId.toString(),
                    no: receiptData.receiptNumber,
                    status: (receiptData as any).status as string | undefined,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(resolvedFromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/sales/receipts');
        revalidatePath('/dashboard/crm/sales/invoices');
        return { message: 'Payment receipt saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
