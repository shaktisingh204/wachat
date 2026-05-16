'use server';

/**
 * CRM Sales Proposals — Mongo-backed server actions.
 *
 * No Rust crate exists for this entity. We persist to the `crm_proposals`
 * collection and follow the canonical pattern:
 *   getSession + requirePermission + connectToDatabase + writeAuditEntry
 *   + soft-delete (status='archived').
 *
 * Field shape:
 *   - proposalNumber (auto, "PROP-XXXXXXXX")
 *   - accountId, title
 *   - sections: Array<{ heading, body }>  (structured proposal body)
 *   - totalAmount, currency
 *   - validUntil (Date)
 *   - status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'archived'
 *   - sentAt, respondedAt (Date)
 *   - attachments: Array<{ url, name }>   (SabFile picks)
 *   - signsCount: number  (denormalised count from `crm_proposal_signs`)
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CrmProposalStatus =
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'archived';

export interface CrmProposalSection {
    heading: string;
    body: string;
}

export interface CrmProposalAttachment {
    url: string;
    name: string;
}

export interface CrmProposalListFilters {
    q?: string;
    status?: CrmProposalStatus | 'all';
    limit?: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function parseSections(raw: FormDataEntryValue | null): CrmProposalSection[] {
    const s = asString(raw);
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((row): CrmProposalSection => ({
                heading: typeof row?.heading === 'string' ? row.heading.trim() : '',
                body: typeof row?.body === 'string' ? row.body : '',
            }))
            .filter((row) => row.heading.length > 0 || row.body.length > 0);
    } catch {
        return [];
    }
}

function parseAttachments(
    raw: FormDataEntryValue | null,
): CrmProposalAttachment[] {
    const s = asString(raw);
    if (!s) return [];
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((row): CrmProposalAttachment => ({
                url: typeof row?.url === 'string' ? row.url.trim() : '',
                name: typeof row?.name === 'string' ? row.name.trim() : '',
            }))
            .filter((row) => row.url.length > 0);
    } catch {
        return [];
    }
}

const VALID_STATUSES = new Set<CrmProposalStatus>([
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'archived',
]);

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getProposals(
    filters?: CrmProposalListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_proposal', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const filter: Record<string, unknown> = { userId: userObjectId };
        const status = filters?.status;
        if (status && status !== 'all') {
            filter.status = status;
        } else {
            // By default, hide archived rows from the list view.
            filter.status = { $ne: 'archived' };
        }

        if (filters?.q) {
            const re = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { title: re },
                { proposalNumber: re },
                { accountId: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_proposals')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db.collection('crm_proposals').countDocuments(filter);
        return {
            items: JSON.parse(JSON.stringify(docs)),
            total,
        };
    } catch (e) {
        console.error('[getProposals] failed:', e);
        return empty;
    }
}

export async function getProposalById(
    proposalId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!proposalId || !ObjectId.isValid(proposalId)) return null;

    const guard = await requirePermission('crm_proposal', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_proposals').findOne({
            _id: new ObjectId(proposalId),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getProposalById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

function generateProposalNumber(): string {
    const ts = Date.now().toString().slice(-8);
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `PROP-${ts}${rnd}`;
}

export async function saveProposal(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const proposalId = asString(formData.get('proposalId'));
    const isEditing = !!proposalId;

    const guard = await requirePermission(
        'crm_proposal',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const title = asString(formData.get('title'));
    if (!title) return { error: 'Title is required.' };

    const accountId = asString(formData.get('accountId'));
    const currency = asString(formData.get('currency')) ?? 'INR';
    const totalAmount = asNumber(formData.get('totalAmount')) ?? 0;
    const validUntilRaw = asString(formData.get('validUntil'));
    const validUntil =
        validUntilRaw ? new Date(validUntilRaw) : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmProposalStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmProposalStatus)
            ? (statusRaw as CrmProposalStatus)
            : 'draft';

    const sections = parseSections(formData.get('sections'));
    const attachments = parseAttachments(formData.get('attachments'));

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(proposalId!)) {
                return { error: 'Invalid proposal id.' };
            }
            const existing = await db.collection('crm_proposals').findOne({
                _id: new ObjectId(proposalId!),
                userId: userObjectId,
            });
            if (!existing) return { error: 'Proposal not found.' };

            const $set: Record<string, unknown> = {
                title,
                ...(accountId !== undefined ? { accountId } : {}),
                currency,
                totalAmount,
                ...(validUntil && !Number.isNaN(validUntil.getTime())
                    ? { validUntil }
                    : { validUntil: null }),
                status,
                sections,
                attachments,
                updatedAt: now,
            };

            // Track sentAt / respondedAt transitions.
            const prevStatus = existing.status as CrmProposalStatus | undefined;
            if (status === 'sent' && prevStatus !== 'sent' && !existing.sentAt) {
                $set.sentAt = now;
            }
            if (
                (status === 'accepted' || status === 'rejected') &&
                prevStatus !== status &&
                !existing.respondedAt
            ) {
                $set.respondedAt = now;
            }

            await db.collection('crm_proposals').updateOne(
                { _id: new ObjectId(proposalId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'proposal',
                    entityId: proposalId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/crm/sales/proposals');
            revalidatePath(`/dashboard/crm/sales/proposals/${proposalId}`);
            return { message: 'Proposal updated.', id: proposalId };
        }

        const proposalNumber = generateProposalNumber();
        const doc: Record<string, unknown> = {
            userId: userObjectId,
            proposalNumber,
            title,
            ...(accountId ? { accountId } : {}),
            currency,
            totalAmount,
            ...(validUntil && !Number.isNaN(validUntil.getTime())
                ? { validUntil }
                : {}),
            status,
            sections,
            attachments,
            signsCount: 0,
            ...(status === 'sent' ? { sentAt: now } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_proposals').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'proposal',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/proposals');
        return {
            message: `Proposal ${proposalNumber} created.`,
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save proposal: ${getErrorMessage(e)}` };
    }
}

export async function deleteProposal(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid proposal id.' };
    }

    const guard = await requirePermission('crm_proposal', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_proposals').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Proposal not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'proposal',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/proposals');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
