'use server';

/**
 * CRM Webhook subscriptions — admin server actions (Phase 7 foundation).
 *
 * Backs `/dashboard/crm/settings/webhooks` (list / new / detail). All
 * mutations gated by the `crm_settings` permission. Secrets are encrypted
 * at rest via `encryptWebhookSecret` and the plain secret is returned
 * EXACTLY ONCE at creation time.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Document, type Filter } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import {
    CRM_WEBHOOK_EVENTS,
    encryptWebhookSecret,
    generateWebhookSecret,
    type CrmWebhookEvent,
    type CrmWebhookStatus,
} from '@/lib/webhooks/dispatch';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

/* ── Public DTO (UI-safe; no secret material leaked except on create) ──── */

interface CrmWebhookRow {
    _id: string;
    name: string;
    targetUrl: string;
    events: string[];
    status: CrmWebhookStatus;
    createdAt: string;
    lastDeliveryAt: string | null;
    failureCount: number;
}

interface CreateWebhookSuccess {
    ok: true;
    row: CrmWebhookRow;
    /** Plain secret — shown once. */
    secret: string;
}

interface CreateWebhookError {
    ok: false;
    error: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function rowFromDoc(doc: Document & { _id: ObjectId }): CrmWebhookRow {
    return {
        _id: doc._id.toHexString(),
        name: String(doc.name ?? ''),
        targetUrl: String(doc.targetUrl ?? ''),
        events: Array.isArray(doc.events) ? (doc.events as string[]) : [],
        status: (doc.status as CrmWebhookStatus) ?? 'active',
        createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : '',
        lastDeliveryAt:
            typeof doc.lastDeliveryAt === 'string' ? doc.lastDeliveryAt : null,
        failureCount: Number(doc.failureCount ?? 0),
    };
}

function isValidUrl(u: string): boolean {
    try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isKnownEvent(ev: unknown): ev is CrmWebhookEvent {
    return typeof ev === 'string' && (CRM_WEBHOOK_EVENTS as readonly string[]).includes(ev);
}

/* ── Actions ────────────────────────────────────────────────────────────── */

export async function getWebhookSubscriptions(): Promise<CrmWebhookRow[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_settings', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<Document> = {
            tenantUserId: String(session.user._id),
        };
        const docs = await db
            .collection('crm_webhook_subscriptions')
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return docs.map((d) => rowFromDoc(d as Document & { _id: ObjectId }));
    } catch (e) {
        console.error('[crm-webhooks] list failed:', e);
        return [];
    }
}

export async function getWebhookSubscription(
    id: string,
): Promise<CrmWebhookRow | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const guard = await requirePermission('crm_settings', 'view');
    if (!guard.ok) return null;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_webhook_subscriptions').findOne({
            _id: new ObjectId(id),
            tenantUserId: String(session.user._id),
        });
        if (!doc) return null;
        return rowFromDoc(doc as Document & { _id: ObjectId });
    } catch (e) {
        console.error('[crm-webhooks] get failed:', e);
        return null;
    }
}

interface CreateWebhookInput {
    name: string;
    targetUrl: string;
    events: string[];
}

export async function createWebhookSubscription(
    input: CreateWebhookInput,
): Promise<CreateWebhookSuccess | CreateWebhookError> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };
    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    const name = (input.name ?? '').trim();
    if (!name) return { ok: false, error: 'Name is required.' };
    const targetUrl = (input.targetUrl ?? '').trim();
    if (!isValidUrl(targetUrl)) {
        return { ok: false, error: 'targetUrl must be a valid http(s) URL.' };
    }
    const events = Array.isArray(input.events) ? input.events.filter(isKnownEvent) : [];
    if (events.length === 0) {
        return { ok: false, error: 'At least one event is required.' };
    }

    const secret = generateWebhookSecret();
    const now = new Date().toISOString();
    const doc: Document = {
        tenantUserId: String(session.user._id),
        name,
        targetUrl,
        events,
        secret: encryptWebhookSecret(secret),
        status: 'active' as CrmWebhookStatus,
        failureCount: 0,
        createdAt: now,
    };

    try {
        const { db } = await connectToDatabase();
        const result = await db
            .collection('crm_webhook_subscriptions')
            .insertOne(doc);
        revalidatePath('/dashboard/crm/settings/webhooks');
        void recordFlowAction('crm.webhook.created', {
            userId: String(session.user._id),
            target: String(result.insertedId),
            metadata: { name, targetUrl, events },
        });
        return {
            ok: true,
            secret,
            row: rowFromDoc({ ...doc, _id: result.insertedId } as Document & {
                _id: ObjectId;
            }),
        };
    } catch (e) {
        console.error('[crm-webhooks] create failed:', e);
        return { ok: false, error: 'Failed to create subscription.' };
    }
}

interface UpdateWebhookInput {
    name?: string;
    targetUrl?: string;
    events?: string[];
    status?: CrmWebhookStatus;
}

export async function updateWebhookSubscription(
    id: string,
    input: UpdateWebhookInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };
    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return { ok: false, error: 'Invalid id.' };
    }

    const set: Document = { updatedAt: new Date().toISOString() };
    if (typeof input.name === 'string' && input.name.trim()) set.name = input.name.trim();
    if (typeof input.targetUrl === 'string') {
        if (!isValidUrl(input.targetUrl)) {
            return { ok: false, error: 'targetUrl must be a valid http(s) URL.' };
        }
        set.targetUrl = input.targetUrl.trim();
    }
    if (Array.isArray(input.events)) {
        const events = input.events.filter(isKnownEvent);
        if (events.length === 0) {
            return { ok: false, error: 'At least one event is required.' };
        }
        set.events = events;
    }
    if (input.status === 'active' || input.status === 'paused') {
        set.status = input.status;
        if (input.status === 'active') set.failureCount = 0;
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_webhook_subscriptions').updateOne(
            { _id: new ObjectId(id), tenantUserId: String(session.user._id) },
            { $set: set },
        );
        if (result.matchedCount === 0) {
            return { ok: false, error: 'Subscription not found.' };
        }
        revalidatePath('/dashboard/crm/settings/webhooks');
        revalidatePath(`/dashboard/crm/settings/webhooks/${id}`);
        return { ok: true };
    } catch (e) {
        console.error('[crm-webhooks] update failed:', e);
        return { ok: false, error: 'Failed to update subscription.' };
    }
}

export async function deleteWebhookSubscription(
    id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };
    const guard = await requirePermission('crm_settings', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
        return { ok: false, error: 'Invalid id.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_webhook_subscriptions').deleteOne({
            _id: new ObjectId(id),
            tenantUserId: String(session.user._id),
        });
        if (result.deletedCount === 0) {
            return { ok: false, error: 'Subscription not found.' };
        }
        revalidatePath('/dashboard/crm/settings/webhooks');
        void recordFlowAction('crm.webhook.deleted', {
            userId: String(session.user._id),
            target: id,
        });
        return { ok: true };
    } catch (e) {
        console.error('[crm-webhooks] delete failed:', e);
        return { ok: false, error: 'Failed to delete subscription.' };
    }
}

/** Re-exports for client components that need the event catalogue. */
export async function listKnownEvents(): Promise<readonly string[]> {
    return CRM_WEBHOOK_EVENTS;
}
