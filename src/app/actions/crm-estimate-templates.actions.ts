'use server';

/**
 * CRM Sales Estimate Templates — Mongo-backed server actions.
 *
 * No Rust crate exists for this entity. We persist to the
 * `crm_estimate_templates` collection.
 *
 * Field shape:
 *   - name
 *   - category
 *   - templateBody (long markdown body)
 *   - defaultItems: Array<{ description, quantity, rate }>
 *   - defaultTerms (long text)
 *   - isActive (boolean)
 *   - status: 'draft' | 'published' | 'archived'
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────── */

type CrmEstimateTemplateStatus = 'draft' | 'published' | 'archived';

interface CrmEstimateTemplateItem {
    description: string;
    quantity: number;
    rate: number;
}

interface CrmEstimateTemplateListFilters {
    q?: string;
    status?: CrmEstimateTemplateStatus | 'all';
    category?: string;
    limit?: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

const VALID_STATUSES = new Set<CrmEstimateTemplateStatus>([
    'draft',
    'published',
    'archived',
]);

function parseDefaultItems(
    raw: FormDataEntryValue | null,
): CrmEstimateTemplateItem[] {
    const s = asString(raw);
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((row): CrmEstimateTemplateItem => {
                const r = row as Record<string, unknown>;
                const description =
                    typeof r?.description === 'string' ? r.description.trim() : '';
                const quantity =
                    typeof r?.quantity === 'number'
                        ? r.quantity
                        : parseFloat(String(r?.quantity ?? ''));
                const rate =
                    typeof r?.rate === 'number'
                        ? r.rate
                        : parseFloat(String(r?.rate ?? ''));
                return {
                    description,
                    quantity: Number.isFinite(quantity) ? quantity : 0,
                    rate: Number.isFinite(rate) ? rate : 0,
                };
            })
            .filter((row) => row.description.length > 0);
    } catch {
        return [];
    }
}

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getEstimateTemplates(
    filters?: CrmEstimateTemplateListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_estimate_template', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const filter: Record<string, unknown> = { userId: userObjectId };
        const status = filters?.status;
        if (status && status !== 'all') {
            filter.status = status;
        } else {
            filter.status = { $ne: 'archived' };
        }
        if (filters?.category) {
            filter.category = filters.category;
        }
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [{ name: re }, { category: re }];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_estimate_templates')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db
            .collection('crm_estimate_templates')
            .countDocuments(filter);
        return {
            items: JSON.parse(JSON.stringify(docs)),
            total,
        };
    } catch (e) {
        console.error('[getEstimateTemplates] failed:', e);
        return empty;
    }
}

export async function getEstimateTemplateById(
    templateId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!templateId || !ObjectId.isValid(templateId)) return null;

    const guard = await requirePermission('crm_estimate_template', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_estimate_templates').findOne({
            _id: new ObjectId(templateId),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getEstimateTemplateById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function saveEstimateTemplate(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const templateId = asString(formData.get('templateId'));
    const isEditing = !!templateId;

    const guard = await requirePermission(
        'crm_estimate_template',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Template name is required.' };

    const category = asString(formData.get('category'));
    const templateBody = asString(formData.get('templateBody'));
    const defaultTerms = asString(formData.get('defaultTerms'));
    const defaultItems = parseDefaultItems(formData.get('defaultItems'));
    const isActive = formData.get('isActive') === 'on';

    const statusRaw = asString(formData.get('status'));
    const status: CrmEstimateTemplateStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmEstimateTemplateStatus)
            ? (statusRaw as CrmEstimateTemplateStatus)
            : 'draft';

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(templateId!)) {
                return { error: 'Invalid template id.' };
            }
            const existing = await db
                .collection('crm_estimate_templates')
                .findOne({
                    _id: new ObjectId(templateId!),
                    userId: userObjectId,
                });
            if (!existing) return { error: 'Template not found.' };

            const $set: Record<string, unknown> = {
                name,
                ...(category !== undefined ? { category } : {}),
                ...(templateBody !== undefined ? { templateBody } : {}),
                ...(defaultTerms !== undefined ? { defaultTerms } : {}),
                defaultItems,
                isActive,
                status,
                updatedAt: now,
            };

            await db.collection('crm_estimate_templates').updateOne(
                { _id: new ObjectId(templateId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'estimate_template',
                    entityId: templateId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/estimates-templates');
            revalidatePath(
                `/dashboard/crm/sales/estimates-templates/${templateId}`,
            );
            return { message: 'Estimate template updated.', id: templateId };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            name,
            ...(category ? { category } : {}),
            ...(templateBody ? { templateBody } : {}),
            ...(defaultTerms ? { defaultTerms } : {}),
            defaultItems,
            isActive,
            status,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db
            .collection('crm_estimate_templates')
            .insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'estimate_template',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/estimates-templates');
        return {
            message: 'Estimate template created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return {
            error: `Failed to save estimate template: ${getErrorMessage(e)}`,
        };
    }
}

export async function deleteEstimateTemplate(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid template id.' };
    }

    const guard = await requirePermission('crm_estimate_template', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_estimate_templates').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Template not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'estimate_template',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/estimates-templates');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
