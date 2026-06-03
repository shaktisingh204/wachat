'use server';

/**
 * CRM Quotation server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, the read/save paths delegate to
 *    `/v1/crm/quotations` on the Rust BFF via
 *    `src/lib/rust-client/crm-quotations.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/sales/quotations/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmQuotation, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import {
    crmQuotationsApi,
    type CrmQuotationLineItem,
} from '@/lib/rust-client/crm-quotations';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

async function getNextQuotationNumber(db: Db, userId: ObjectId): Promise<string> {
    const lastQuotation = await db.collection<CrmQuotation>('crm_quotations')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

    if (lastQuotation.length === 0) {
        return 'QUO-00001';
    }

    const lastNumber = lastQuotation[0].quotationNumber;
    // Regex to find a prefix and a number at the end of the string
    const matches = lastNumber.match(/^(.*?)(\d+)$/);

    if (matches && matches.length === 3) {
        const prefix = matches[1];
        const numPart = parseInt(matches[2], 10);
        const newNum = numPart + 1;
        // Pad the new number to the same length as the old one
        const paddedNum = String(newNum).padStart(matches[2].length, '0');
        return `${prefix}${paddedNum}`;
    }

    // Fallback for unexpected formats or if no number is found
    return `QUO-${Date.now().toString().slice(-5)}`;
}

export async function getQuotations(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ quotations: WithId<CrmQuotation>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { quotations: [], total: 0 };

    if (useRustCrm()) {
        try {
            const items = await crmQuotationsApi.list({ page, limit, q: query });
            const arr = Array.isArray(items) ? items : [];
            return {
                quotations: JSON.parse(JSON.stringify(arr)) as WithId<CrmQuotation>[],
                total: arr.length,
            };
        } catch (e) {
            console.error('[getQuotations] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'quotation', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };

        const skip = (page - 1) * limit;

        const [quotations, total] = await Promise.all([
            db.collection('crm_quotations')
                .find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_quotations').countDocuments(filter)
        ]);

        return {
            quotations: JSON.parse(JSON.stringify(quotations)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM quotations:", e);
        return { quotations: [], total: 0 };
    }
}

export async function getQuotationById(quotationId: string): Promise<WithId<CrmQuotation> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmQuotationsApi.getById(quotationId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmQuotation>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.code === 'NOT_FOUND') return null;
            console.error('[getQuotationById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'quotation', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(quotationId)) return null;

    try {
        const { db } = await connectToDatabase();
        const quotation = await db.collection('crm_quotations').findOne({
            _id: new ObjectId(quotationId),
            userId: new ObjectId(session.user._id),
        });
        if (!quotation) return null;
        return JSON.parse(JSON.stringify(quotation));
    } catch (e) {
        console.error('Failed to fetch quotation by id:', e);
        return null;
    }
}

export async function saveQuotation(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    if (useRustCrm()) {
        try {
            const lineItemsLegacy = JSON.parse((formData.get('lineItems') as string) || '[]') as Array<any>;
            const items: CrmQuotationLineItem[] = lineItemsLegacy.map((li: any) => ({
                itemId: li.itemId,
                description: li.description ?? li.name,
                qty: Number(li.quantity ?? li.qty ?? 0),
                rate: Number(li.rate ?? 0),
                total: Number(li.total ?? Number(li.quantity ?? 0) * Number(li.rate ?? 0)),
            }));

            let designMetadata: Record<string, unknown> | undefined = undefined;
            const dmRaw = formData.get('designMetadata') as string | null;
            if (dmRaw) {
                try {
                    designMetadata = JSON.parse(dmRaw);
                } catch {
                    // ignore malformed
                }
            }

            const quotationNo = (formData.get('quotationNumber') as string | null) ||
                `QUO-${Date.now().toString().slice(-5)}`;
            const dateRaw = (formData.get('quotationDate') as string | null) || '';
            const date = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
            const validTillRaw = (formData.get('validTillDate') as string | null) || '';
            const validUntil = validTillRaw ? new Date(validTillRaw).toISOString() : date;
            const clientId = (formData.get('accountId') as string | null) || '';
            const currency = (formData.get('currency') as string | null) || 'INR';
            const notes = (formData.get('notes') as string | null) || undefined;
            const fromKindRaw = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            const created = await crmQuotationsApi.create({
                quotationNo,
                date,
                validUntil,
                clientId,
                currency,
                items,
                notes,
                fromKind: fromKindRaw as any,
                fromId,
                designMetadata,
            });
            const id = (created as any)._id?.toString() || '';

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'quotation',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }

            const customFieldsRaw = formData.get('customFields') as string | null;
            if (customFieldsRaw && id) {
                try {
                    const parsed = JSON.parse(customFieldsRaw);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        await applyCustomFieldsToEntity('quotation', id, parsed as Record<string, unknown>);
                    }
                } catch {
                    /* non-fatal */
                }
            }

            revalidatePath('/dashboard/crm/sales/quotations');
            return { message: 'Quotation saved successfully.' };
        } catch (e) {
            console.error('[saveQuotation] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'quotation', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        let quotationNumber = formData.get('quotationNumber') as string;

        // If the quotation number is empty, generate a new one.
        if (!quotationNumber) {
            quotationNumber = await getNextQuotationNumber(db, userObjectId);
        }

        const lineItems = JSON.parse(formData.get('lineItems') as string || '[]');
        const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.quantity * item.rate), 0);

        const attachmentsRaw = formData.get('attachmentUrls') as string | null;
        let attachments: string[] | undefined;
        if (attachmentsRaw) {
            try {
                const parsed = JSON.parse(attachmentsRaw);
                if (Array.isArray(parsed)) {
                    attachments = parsed.filter((u): u is string => typeof u === 'string' && !!u);
                }
            } catch {
                // ignore malformed JSON
            }
        }

        const accountIdRaw = (formData.get('accountId') as string | null) || '';
        if (!ObjectId.isValid(accountIdRaw)) {
            return { error: 'A valid client is required.' };
        }

        const quotationData: Omit<CrmQuotation, '_id' | 'createdAt' | 'updatedAt'> = {
            userId: userObjectId,
            accountId: new ObjectId(accountIdRaw),
            quotationNumber: quotationNumber,
            quotationDate: new Date(formData.get('quotationDate') as string),
            validTillDate: formData.get('validTillDate') ? new Date(formData.get('validTillDate') as string) : undefined,
            currency: formData.get('currency') as string,
            lineItems: lineItems,
            subtotal: subtotal,
            total: subtotal, // For now, total is same as subtotal
            termsAndConditions: JSON.parse(formData.get('termsAndConditions') as string || '[]'),
            notes: formData.get('notes') as string,
            additionalInfo: JSON.parse(formData.get('additionalInfo') as string || '[]'),
            attachments: attachments && attachments.length ? attachments : undefined,
            status: 'Draft',
        };

        const dmRawLegacy = formData.get('designMetadata') as string | null;
        if (dmRawLegacy) {
            try {
                const parsed = JSON.parse(dmRawLegacy);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    (quotationData as any).designMetadata = parsed;
                }
            } catch {
                // ignore
            }
        }

        if (!quotationData.accountId || lineItems.length === 0) {
            return { error: 'Client and at least one line item are required.' };
        }

        // Final check for duplicates before inserting
        const existing = await db.collection('crm_quotations').findOne({ userId: userObjectId, quotationNumber: quotationData.quotationNumber });
        if (existing) {
            quotationData.quotationNumber = await getNextQuotationNumber(db, userObjectId);
        }

        // Lineage seeding (crm_function_plan.md §13.5). The form may
        // optionally pass `fromKind` + `fromId` when a quotation is
        // created in the context of a parent doc (typically a Lead or
        // a Deal). Both fields are optional, so existing flows keep
        // working unchanged.
        let lineage: LineageRef[] | undefined;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        const ALLOWED_PARENT_KINDS: LineageKind[] = ['lead', 'deal'];
        if (fromKind && fromId && ALLOWED_PARENT_KINDS.includes(fromKind as LineageKind) && ObjectId.isValid(fromId)) {
            const parentCollection: Record<string, string> = {
                lead: 'crm_leads',
                deal: 'crm_deals',
            };
            const parentNoField: Record<string, string> = {
                lead: 'title',
                deal: 'name',
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
                // ignore lineage seed failures — quotation still saves
            }
        }

        const insertResult = await db.collection('crm_quotations').insertOne({
            ...quotationData,
            ...(lineage ? { lineage } : {}),
            createdAt: new Date(),
            updatedAt: new Date()
        } as any);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'quotation',
                entityId: insertResult.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        // Custom fields (Worksuite §13). The dialog wires a JSON-encoded
        // map under `customFields`; persist via the shared upsert helper.
        const customFieldsRaw = formData.get('customFields') as string | null;
        if (customFieldsRaw) {
            let parsedValues: Record<string, unknown> = {};
            try {
                const parsed = JSON.parse(customFieldsRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedValues = parsed as Record<string, unknown>;
                }
            } catch {
                parsedValues = {};
            }
            try {
                await applyCustomFieldsToEntity('quotation', insertResult.insertedId.toString(), parsedValues);
            } catch {
                // non-fatal — quotation already saved
            }
        }

        // Best-effort back-link onto the parent doc.
        if (lineage && fromKind && fromId) {
            try {
                const parentCollection: Record<string, string> = {
                    lead: 'crm_leads',
                    deal: 'crm_deals',
                };
                const coll = parentCollection[fromKind];
                const parent = await db.collection(coll).findOne({ _id: new ObjectId(fromId) });
                const updatedParentLineage = appendLineage(parent?.lineage as LineageRef[] | undefined, {
                    kind: 'quotation',
                    id: insertResult.insertedId.toString(),
                    no: quotationData.quotationNumber,
                    status: quotationData.status,
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

        revalidatePath('/dashboard/crm/sales/quotations');
        return { message: 'Quotation saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
