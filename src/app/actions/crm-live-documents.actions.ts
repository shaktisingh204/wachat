'use server';

/**
 * Generic "live document" server action.
 *
 * Backs the `LiveDocumentEditor` for every CRM + HRM document-shaped entity
 * that does not have a dedicated server action (i.e. contracts, offer letters,
 * exit letters, notices, policies, etc.).
 *
 * Sales documents (proposal/estimate/quotation/invoice/...) continue to use
 * their existing per-type actions because those drive PDF render pipelines
 * and downstream automations. Everything else funnels through here.
 *
 * Persistence:
 *   collection: `live_documents`
 *   shape:      one row per document, keyed by `_id`, scoped by `tenantId`,
 *               distinguished by `documentType`
 *
 * The action accepts the canonical FormData payload the editor emits:
 *   - documentType   (string, required)
 *   - title          (string, required)
 *   - status, currency, totalAmount, validUntil
 *   - accountId | employeeId | candidateId | vendorId
 *   - sections, lineItems, attachments, designMetadata (JSON-encoded)
 *   - id / `${documentType}Id` (when editing)
 *   - parentType / parentId    (optional — links to a parent record)
 *
 * Permission gating is by document type. We map each `documentType` to a
 * canonical permission key + scope so RBAC stays honest, with a safe
 * fallback to the generic `live_document` key.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';

const COLLECTION = 'live_documents';

type SaveResult = { message?: string; error?: string; id?: string };

interface SectionInput {
    heading: string;
    body: string;
}

interface AttachmentInput {
    url: string;
    name: string;
}

function asString(v: FormDataEntryValue | null): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    if (typeof v !== 'string') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function parseJsonArray<T>(raw: FormDataEntryValue | null): T[] {
    if (typeof raw !== 'string' || raw.length === 0) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
        return [];
    }
}

function parseJsonObject(raw: FormDataEntryValue | null): Record<string, unknown> | undefined {
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Map a document type to (rbacEntityKey, auditEntityKind). Each entry is the
 * canonical permission key SabNode already uses elsewhere for that entity.
 * If we don't have a specific key, the caller falls back to `live_document`.
 */
const PERMISSION_KEYS: Record<string, { rbac: string; audit: string }> = {
    contract: { rbac: 'crm_contract', audit: 'contract' },
    service_contract: { rbac: 'crm_service_contract', audit: 'service_contract' },
    purchase_order: { rbac: 'crm_purchase_order', audit: 'purchase_order' },
    expense_report: { rbac: 'crm_expense', audit: 'expense_report' },
    payout: { rbac: 'crm_payout', audit: 'payout' },
    debit_note: { rbac: 'crm_debit_note', audit: 'debit_note' },

    offer_letter: { rbac: 'hrm_offer', audit: 'offer_letter' },
    exit_letter: { rbac: 'hrm_exit', audit: 'exit_letter' },
    award: { rbac: 'hrm_award', audit: 'award' },
    certification: { rbac: 'hrm_certification', audit: 'certification' },
    expense_claim: { rbac: 'hrm_expense_claim', audit: 'expense_claim' },
    travel_request: { rbac: 'hrm_travel', audit: 'travel_request' },
    disciplinary_letter: { rbac: 'hrm_disciplinary', audit: 'disciplinary_letter' },
    notice: { rbac: 'hrm_notice', audit: 'notice' },
    announcement: { rbac: 'hrm_announcement', audit: 'announcement' },
    feedback_360: { rbac: 'hrm_feedback_360', audit: 'feedback_360' },
    probation_letter: { rbac: 'hrm_probation', audit: 'probation_letter' },
    recognition: { rbac: 'hrm_recognition', audit: 'recognition' },
    policy: { rbac: 'hrm_policy', audit: 'policy' },
    document_template: { rbac: 'hrm_document_template', audit: 'document_template' },
};

function keysFor(documentType: string): { rbac: string; audit: string } {
    return PERMISSION_KEYS[documentType] ?? { rbac: 'live_document', audit: 'live_document' };
}

/**
 * Save (create or update) a live document.
 *
 * Used by every CRM/HRM module that mounts `LiveDocumentEditor` and does not
 * already have a dedicated per-type save action.
 */
export async function saveLiveDocument(
    _prev: SaveResult | undefined,
    formData: FormData,
): Promise<SaveResult> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const documentType = asString(formData.get('documentType'));
    if (!documentType) return { error: 'documentType is required.' };

    const documentId =
        asString(formData.get('id')) ??
        asString(formData.get(`${documentType}Id`));
    const isEditing = !!documentId;

    const { rbac, audit } = keysFor(documentType);
    const guard = await requirePermission(rbac, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const title = asString(formData.get('title'));
    if (!title) return { error: 'Title is required.' };

    const status = asString(formData.get('status')) ?? 'draft';
    const currency = asString(formData.get('currency')) ?? 'INR';
    const totalAmount = asNumber(formData.get('totalAmount')) ?? 0;

    const validUntilRaw = asString(formData.get('validUntil'));
    const validUntil =
        validUntilRaw && !Number.isNaN(new Date(validUntilRaw).getTime())
            ? new Date(validUntilRaw)
            : undefined;

    const accountId = asString(formData.get('accountId'));
    const employeeId = asString(formData.get('employeeId'));
    const candidateId = asString(formData.get('candidateId'));
    const vendorId = asString(formData.get('vendorId'));

    const parentType = asString(formData.get('parentType'));
    const parentId = asString(formData.get('parentId'));

    const sections = parseJsonArray<SectionInput>(formData.get('sections'));
    const lineItems = parseJsonArray<Record<string, unknown>>(formData.get('lineItems'));
    const attachments = parseJsonArray<AttachmentInput>(formData.get('attachments'));
    const designMetadata = parseJsonObject(formData.get('designMetadata'));

    try {
        const { db } = await connectToDatabase();
        const coll = db.collection(COLLECTION);

        const tenantId = String(session.user.tenantId ?? session.user._id);
        const actorId = String(session.user._id);
        const now = new Date();

        const baseFields = {
            tenantId,
            documentType,
            title,
            status,
            currency,
            totalAmount,
            validUntil,
            accountId,
            employeeId,
            candidateId,
            vendorId,
            parentType,
            parentId,
            sections,
            lineItems,
            attachments,
            designMetadata,
        };

        if (isEditing) {
            if (!ObjectId.isValid(documentId!)) {
                return { error: 'Invalid document id.' };
            }
            const _id = new ObjectId(documentId!);
            const updateResult = await coll.updateOne(
                { _id, tenantId },
                {
                    $set: {
                        ...baseFields,
                        updatedAt: now,
                        updatedBy: actorId,
                    },
                },
            );
            if (updateResult.matchedCount === 0) {
                return { error: 'Document not found or you do not have access.' };
            }

            try {
                await writeAuditEntry({
                    tenantUserId: actorId,
                    actorId,
                    action: 'update',
                    entityKind: audit,
                    entityId: documentId!,
                });
            } catch {
                /* non-fatal */
            }

            return { message: `${formatLabel(documentType)} updated.`, id: documentId };
        }

        const insertResult = await coll.insertOne({
            ...baseFields,
            createdAt: now,
            createdBy: actorId,
            updatedAt: now,
            updatedBy: actorId,
        });

        const newId = insertResult.insertedId.toHexString();
        try {
            await writeAuditEntry({
                tenantUserId: actorId,
                actorId,
                action: 'create',
                entityKind: audit,
                entityId: newId,
            });
        } catch {
            /* non-fatal */
        }

        return { message: `${formatLabel(documentType)} created.`, id: newId };
    } catch (e) {
        console.error('[saveLiveDocument] failed:', e);
        return { error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single live document for the edit page. Returns the raw mongo doc
 * with `_id` stringified so the editor can hydrate `initialData`.
 */
export async function loadLiveDocument(
    documentType: string,
    id: string,
): Promise<Record<string, unknown> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const { rbac } = keysFor(documentType);
    const guard = await requirePermission(rbac, 'view');
    if (!guard.ok) return null;

    if (!ObjectId.isValid(id)) return null;

    const { db } = await connectToDatabase();
    const tenantId = String(session.user.tenantId ?? session.user._id);
    const doc = await db
        .collection(COLLECTION)
        .findOne({ _id: new ObjectId(id), tenantId, documentType });
    if (!doc) return null;

    return {
        ...doc,
        _id: doc._id.toString(),
        validUntil: doc.validUntil ? new Date(doc.validUntil as Date).toISOString() : '',
    };
}

/**
 * Soft-delete a live document by setting `status = 'archived'`.
 * Returns true on success.
 */
export async function archiveLiveDocument(documentType: string, id: string): Promise<SaveResult> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const { rbac, audit } = keysFor(documentType);
    const guard = await requirePermission(rbac, 'delete');
    if (!guard.ok) return { error: guard.error };

    if (!ObjectId.isValid(id)) return { error: 'Invalid document id.' };

    try {
        const { db } = await connectToDatabase();
        const tenantId = String(session.user.tenantId ?? session.user._id);
        const actorId = String(session.user._id);

        const res = await db.collection(COLLECTION).updateOne(
            { _id: new ObjectId(id), tenantId, documentType },
            { $set: { status: 'archived', archivedAt: new Date(), updatedBy: actorId } },
        );
        if (res.matchedCount === 0) {
            return { error: 'Document not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: actorId,
                actorId,
                action: 'delete',
                entityKind: audit,
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm');
        revalidatePath('/dashboard/hrm');
        return { message: `${formatLabel(documentType)} archived.`, id };
    } catch (e) {
        console.error('[archiveLiveDocument] failed:', e);
        return { error: getErrorMessage(e) };
    }
}

function formatLabel(type: string): string {
    return type
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
}
