'use server';

/**
 * CRM Credit Note server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, the read/save paths delegate to
 *    `/v1/crm/credit-notes` on the Rust BFF via
 *    `src/lib/rust-client/crm-credit-notes.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/sales/credit-notes/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmCreditNote, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import {
    crmCreditNotesApi,
    type CreditNoteReason,
    type CreditNoteLineItem,
    type CreditNoteTotals,
    type RefundMode,
} from '@/lib/rust-client/crm-credit-notes';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

async function getNextCreditNoteNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastNote = await db.collection<CrmCreditNote>('crm_credit_notes')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastNote.length === 0) {
        return 'CN-00001';
    }

    const lastNumber = lastNote[0].creditNoteNumber;
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    // Fallback for unexpected formats
    return `CN-${Date.now().toString().slice(-5)}`;
}

export async function getCreditNoteById(creditNoteId: string): Promise<WithId<CrmCreditNote> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmCreditNotesApi.getById(creditNoteId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmCreditNote>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.code === 'NOT_FOUND') return null;
            console.error('[getCreditNoteById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'credit_note', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(creditNoteId)) return null;

    try {
        const { db } = await connectToDatabase();
        const note = await db.collection('crm_credit_notes').findOne({
            _id: new ObjectId(creditNoteId),
            userId: new ObjectId(session.user._id),
        });
        if (!note) return null;
        return JSON.parse(JSON.stringify(note));
    } catch (e) {
        console.error('Failed to fetch credit note by id:', e);
        return null;
    }
}

export async function getCreditNotes(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ notes: WithId<CrmCreditNote>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notes: [], total: 0 };

    if (useRustCrm()) {
        try {
            const items = await crmCreditNotesApi.list({ page, limit, q: query });
            const arr = Array.isArray(items) ? items : [];
            return {
                notes: JSON.parse(JSON.stringify(arr)) as WithId<CrmCreditNote>[],
                total: arr.length,
            };
        } catch (e) {
            console.error('[getCreditNotes] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'credit_note', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            db.collection('crm_credit_notes')
                .find(filter)
                .sort({ creditNoteDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_credit_notes').countDocuments(filter)
        ]);

        return {
            notes: JSON.parse(JSON.stringify(notes)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch credit notes:", e);
        return { notes: [], total: 0 };
    }
}

export async function saveCreditNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    if (useRustCrm()) {
        try {
            const lineItemsLegacy = JSON.parse((formData.get('lineItems') as string) || '[]') as Array<any>;
            const items: CreditNoteLineItem[] = lineItemsLegacy.map((li: any) => ({
                itemId: li.itemId,
                description: li.description ?? li.name,
                qty: Number(li.quantity ?? li.qty ?? 0),
                rate: Number(li.rate ?? 0),
                total: Number(li.total ?? Number(li.quantity ?? 0) * Number(li.rate ?? 0)),
            }));
            const subTotal = items.reduce((sum, li) => sum + (li.total || 0), 0);
            const totals: CreditNoteTotals = { subTotal, total: subTotal };

            const cnNo = (formData.get('creditNoteNumber') as string | null) ||
                `CN-${Date.now().toString().slice(-5)}`;
            const dateRaw = (formData.get('creditNoteDate') as string | null) || '';
            const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
            const clientId = (formData.get('accountId') as string | null) || '';
            const reason = ((formData.get('reason') as string | null) || 'other') as CreditNoteReason;
            const currency = (formData.get('currency') as string | null) || 'INR';
            const refundMode = ((formData.get('refundMode') as string | null) || 'credit') as RefundMode;
            const fromKindRaw = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            let designMetadata: Record<string, unknown> | undefined = undefined;
            const dmRaw = formData.get('designMetadata') as string | null;
            if (dmRaw) {
                try {
                    designMetadata = JSON.parse(dmRaw);
                } catch {
                    // ignore malformed
                }
            }

            const created = await crmCreditNotesApi.create({
                cnNo,
                date,
                clientId,
                reason,
                currency,
                items,
                totals,
                refundMode,
                linkedInvoiceId:
                    fromKindRaw === 'invoice' && fromId ? fromId : undefined,
                fromKind: fromKindRaw,
                fromId,
                designMetadata,
            });

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'creditNote',
                    entityId: (created as any)._id?.toString() || '',
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/credit-notes');
            return { message: 'Credit Note saved successfully.' };
        } catch (e) {
            console.error('[saveCreditNote] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'credit_note', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let creditNoteNumber = formData.get('creditNoteNumber') as string;
        if (!creditNoteNumber) {
            creditNoteNumber = await getNextCreditNoteNumber(db, userObjectId);
        }

        const existing = await db.collection('crm_credit_notes').findOne({ userId: userObjectId, creditNoteNumber });
        if (existing) {
            creditNoteNumber = await getNextCreditNoteNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const accountIdRaw = (formData.get('accountId') as string | null) || '';
        if (!ObjectId.isValid(accountIdRaw)) {
            return { error: 'A valid client is required.' };
        }

        const creditNoteData: Omit<CrmCreditNote, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(accountIdRaw),
            creditNoteNumber: creditNoteNumber,
            creditNoteDate: new Date(formData.get('creditNoteDate') as string),
            originalInvoiceNumber: formData.get('originalInvoiceNumber') as string | undefined,
            lineItems: lineItems,
            reason: formData.get('reason') as string,
            currency: formData.get('currency') as string,
            total,
        };

        if (!creditNoteData.creditNoteNumber || !creditNoteData.accountId || lineItems.length === 0) {
            return { error: 'Credit note number, client, and at least one item are required.' };
        }

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a credit note is
        // created in the context of a parent doc. Per the §13.5 chain,
        // a credit note always derives from an invoice, so the only
        // allow-listed parent kind here is `invoice`. Both fields are
        // optional, so existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['invoice'];
        if (
            fromKind &&
            fromId &&
            ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) &&
            ObjectId.isValid(fromId)
        ) {
            try {
                const parent = await db.collection('crm_invoices').findOne(
                    {
                        _id: new ObjectId(fromId),
                        userId: userObjectId,
                    },
                    { projection: { _id: 1, lineage: 1, invoiceNumber: 1, status: 1 } },
                );
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: 'invoice',
                        id: parent._id.toString(),
                        no: (parent.invoiceNumber as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — credit note still saves
            }
        }

        const dmRawLegacy = formData.get('designMetadata') as string | null;
        if (dmRawLegacy) {
            try {
                const parsed = JSON.parse(dmRawLegacy);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    (creditNoteData as any).designMetadata = parsed;
                }
            } catch {
                // ignore
            }
        }

        const insertResult = await db.collection('crm_credit_notes').insertOne({
            ...creditNoteData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'creditNote',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        // Best-effort back-link onto the parent invoice.
        if (lineage && fromKind === 'invoice' && fromId && ObjectId.isValid(fromId)) {
            try {
                const parent = await db.collection('crm_invoices').findOne(
                    { _id: new ObjectId(fromId) },
                    { projection: { _id: 1, lineage: 1 } },
                );
                const updatedParentLineage = appendLineage(
                    parent?.lineage as LineageRef[] | undefined,
                    {
                        kind: 'creditNote',
                        id: insertResult.insertedId.toString(),
                        no: creditNoteData.creditNoteNumber,
                        status: undefined,
                        createdAt: new Date().toISOString(),
                    },
                );
                await db.collection('crm_invoices').updateOne(
                    { _id: new ObjectId(fromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/sales/credit-notes');
        return { message: 'Credit Note saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
