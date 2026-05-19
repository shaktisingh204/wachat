'use server';

/**
 * CRM Debit Note server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, reads and creates delegate to the
 *    Rust BFF (`/v1/crm/debit-notes`) via
 *    `src/lib/rust-client/crm-debit-notes.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so existing pages keep
 * working without changes.
 *
 * `saveDebitNote` only supports create in the legacy path (no edit
 * form exists today); the Rust path mirrors this — update is wired for
 * when an edit form lands.
 */

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDebitNote, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { crmDebitNotesApi } from '@/lib/rust-client/crm-debit-notes';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

async function getNextDebitNoteNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastNote = await db.collection<CrmDebitNote>('crm_debit_notes')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastNote.length === 0) {
        return 'DN-00001';
    }

    const lastNumber = lastNote[0].noteNumber;
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    return `DN-${Date.now().toString().slice(-5)}`;
}

export async function getDebitNotes(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ notes: WithId<CrmDebitNote>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notes: [], total: 0 };

    if (useRustCrm()) {
        try {
            const docs = await crmDebitNotesApi.list({
                page: page - 1,
                limit,
                q: query,
            });
            return {
                notes: JSON.parse(JSON.stringify(docs)) as WithId<CrmDebitNote>[],
                total: docs.length,
            };
        } catch (e) {
            console.error('[getDebitNotes] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'debit_note',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [notes, total] = await Promise.all([
            db.collection('crm_debit_notes')
                .find(filter as any)
                .sort({ noteDate: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_debit_notes').countDocuments(filter as any)
        ]);

        return {
            notes: JSON.parse(JSON.stringify(notes)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM debit notes:", e);
        return { notes: [], total: 0 };
    }
}

export async function saveDebitNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_debit_note', 'create');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const vendorIdRaw = formData.get('vendorId') as string | null;
            const noteDate = formData.get('noteDate') as string | null;
            const lineItemsRaw = formData.get('lineItems') as string | null;
            const lineItems = JSON.parse(lineItemsRaw || '[]');
            const total = lineItems.reduce(
                (sum: number, item: any) => sum + item.qty * item.rate,
                0,
            );

            if (!vendorIdRaw || !noteDate) {
                // let validation in Mongo path handle the error message
                throw new Error('missing required fields');
            }

            // Derive a noteNumber for the Rust payload — the Rust BFF
            // auto-assigns if `dnNo` is empty, but we pre-fill to mirror
            // the legacy "auto-increment" behaviour.
            const noteNumber = (formData.get('noteNumber') as string | null) || '';

            await crmDebitNotesApi.create({
                dnNo: noteNumber,
                date: noteDate,
                vendorId: vendorIdRaw,
                linkedBillId: (formData.get('fromId') as string | null) || undefined,
                reason: ((formData.get('reason') as string | null) || 'other') as any,
                currency: (formData.get('currency') as string | null) || 'INR',
                items: lineItems,
                totals: { subTotal: total, total },
                refundMode: ((formData.get('refundMode') as string | null) || 'credit') as any,
                notes: (formData.get('notes') as string | null) || undefined,
                fromKind: (formData.get('fromKind') as string | null) || undefined,
                fromId: (formData.get('fromId') as string | null) || undefined,
            });

            revalidatePath('/dashboard/crm/purchases/debit-notes');
            return { message: 'Debit note saved successfully.' };
        } catch (e) {
            console.error('[saveDebitNote] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'debit_note',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let noteNumber = formData.get('noteNumber') as string;
        if (!noteNumber) {
            noteNumber = await getNextDebitNoteNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const total = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const noteData: Omit<CrmDebitNote, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            vendorId: new ObjectId(formData.get('vendorId') as string),
            noteNumber: noteNumber,
            noteDate: new Date(formData.get('noteDate') as string),
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            total,
            reason: formData.get('reason') as string,
            notes: formData.get('notes') as string,
            status: 'Draft',
        };

        if (!noteData.noteNumber || !noteData.vendorId) {
            return { error: 'Note number and vendor are required.' };
        }

        const existing = await db.collection('crm_debit_notes').findOne({ userId: userObjectId, noteNumber: noteData.noteNumber });
        if (existing) {
            noteData.noteNumber = await getNextDebitNoteNumber(db, userObjectId);
        }

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a debit note is
        // created in the context of a parent doc. Debit notes typically
        // derive from a Bill (persisted in `crm_expenses`), but a PO is
        // occasionally also a valid origin. Both fields are optional, so
        // existing flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['bill', 'purchaseOrder'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            // Bills live in `crm_expenses` today (see CrmExpense in
            // src/lib/definitions.ts) — no separate bills collection.
            const parentCollection: Record<string, string> = {
                bill: 'crm_expenses',
                purchaseOrder: 'crm_purchase_orders',
            };
            const parentNoField: Record<string, string> = {
                bill: 'referenceNumber',
                purchaseOrder: 'orderNumber',
            };
            const coll = parentCollection[fromKind];
            try {
                const parent = await db.collection(coll).findOne({
                    _id: new ObjectId(fromId),
                    userId: userObjectId,
                });
                if (parent) {
                    lineage = buildLineageFromParent({
                        kind: fromKind as LineageKind,
                        id: parent._id.toString(),
                        no: (parent[parentNoField[fromKind]] as string | undefined) || undefined,
                        status: (parent.status as string | undefined) || undefined,
                        lineage: (parent.lineage as LineageRef[] | undefined) ?? undefined,
                    });
                }
            } catch {
                // ignore lineage seed failures — debit note still saves
            }
        }

        const insertResult = await db.collection('crm_debit_notes').insertOne({
            ...noteData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    bill: 'crm_expenses',
                    purchaseOrder: 'crm_purchase_orders',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'debitNote',
                    id: insertResult.insertedId.toString(),
                    no: noteData.noteNumber,
                    status: noteData.status,
                    createdAt: new Date().toISOString(),
                });
                await db.collection(coll).updateOne(
                    { _id: new ObjectId(fromId) },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { message: 'Debit note saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getDebitNoteById(noteId: string): Promise<WithId<CrmDebitNote> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmDebitNotesApi.getById(noteId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmDebitNote>) : null;
        } catch (e) {
            console.error('[getDebitNoteById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'debit_note',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(noteId)) return null;
    try {
        const { db } = await connectToDatabase();
        const note = await db.collection('crm_debit_notes').findOne({
            _id: new ObjectId(noteId),
            userId: new ObjectId(session.user._id),
        });
        if (!note) return null;
        return JSON.parse(JSON.stringify(note));
    } catch (e) {
        console.error('Failed to fetch debit note by id:', e);
        return null;
    }
}

export async function deleteDebitNote(noteId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_debit_note', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!noteId) return { success: false, error: 'Invalid ID.' };

    if (useRustCrm()) {
        try {
            await crmDebitNotesApi.delete(noteId);
            revalidatePath('/dashboard/crm/purchases/debit-notes');
            return { success: true };
        } catch (e) {
            console.error('[deleteDebitNote] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'debit_note',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(noteId)) return { success: false, error: 'Invalid ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_debit_notes').deleteOne({
            _id: new ObjectId(noteId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Note not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/purchases/debit-notes');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
