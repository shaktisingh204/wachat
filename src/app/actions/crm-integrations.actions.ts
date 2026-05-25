'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getLeadGenConfig } from '@/lib/rust-client/wachat-facebook-leadgen-config';
import { getErrorMessage } from '@/lib/utils';

const INTEGRATIONS_COLLECTION = 'crm_integrations';
const BASE_PATH = '/dashboard/crm/integrations';

/** Shape returned by `getIntegrationById` and friends. */
export interface CrmIntegrationDoc {
    _id: string;
    name: string;
    provider: string;
    status: 'connected' | 'disconnected' | 'error';
    isActive: boolean;
    webhookUrl?: string;
    config?: Record<string, unknown>;
    /** Always the sentinel `'***hidden***'` — never the real secret. */
    credentialsHidden?: '***hidden***';
    syncStatus?: string;
    lastSyncAt?: string;
    createdAt?: string;
    updatedAt?: string;
}

export type IntegrationStatusData = {
    connected: boolean;
    lastSyncAt?: string;
    syncStatus?: string;
};

export type IntegrationStatus = {
    shopify: IntegrationStatusData;
    zapier: IntegrationStatusData;
    mailchimp: IntegrationStatusData;
    slack: IntegrationStatusData;
    gmail: IntegrationStatusData;
    whatsapp: IntegrationStatusData;
    facebook: IntegrationStatusData;
};

const EMPTY_STATUS: IntegrationStatus = {
    shopify: { connected: false },
    zapier: { connected: false },
    mailchimp: { connected: false },
    slack: { connected: false },
    gmail: { connected: false },
    whatsapp: { connected: false },
    facebook: { connected: false },
};

export async function getIntegrationTypes(): Promise<IntegrationStatus> {
    const session = await getSession();
    if (!session?.user) return EMPTY_STATUS;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [emailAccount, whatsappAccount, leadGen] = await Promise.all([
            db.collection('google_tokens').findOne({ userId: userObjectId }),
            db.collection('whatsapp_configs').findOne({ userId: userObjectId }),
            getLeadGenConfig().catch(() => ({ config: null })),
        ]);

        return {
            shopify: { connected: false },
            zapier: { connected: false },
            mailchimp: { connected: false },
            slack: { connected: false },
            gmail: { 
                connected: !!emailAccount,
                lastSyncAt: emailAccount?.lastSyncAt ? new Date(emailAccount.lastSyncAt).toISOString() : undefined,
                syncStatus: emailAccount?.syncStatus || (emailAccount ? 'ok' : undefined),
            },
            whatsapp: { 
                connected: !!whatsappAccount,
                lastSyncAt: whatsappAccount?.lastSyncAt ? new Date(whatsappAccount.lastSyncAt).toISOString() : undefined,
                syncStatus: whatsappAccount?.syncStatus || (whatsappAccount ? 'ok' : undefined),
            },
            facebook: { 
                connected: !!(leadGen?.config?.pageId && leadGen.config.isActive),
                lastSyncAt: leadGen?.config?.lastSyncAt ? new Date(leadGen.config.lastSyncAt).toISOString() : undefined,
                syncStatus: leadGen?.config?.syncStatus || (leadGen?.config?.isActive ? 'ok' : undefined),
            },
        };
    } catch (e) {
        console.error("Failed to fetch integration status:", e);
        return EMPTY_STATUS;
    }
}

export async function getCustomIntegrations(): Promise<CrmIntegrationDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(INTEGRATIONS_COLLECTION)
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return docs.map(redact);
    } catch (e) {
        console.error('[getCustomIntegrations] failed:', e);
        return [];
    }
}

/* ─── CRUD against `crm_integrations` ────────────────────────────────── */

function redact(doc: any): CrmIntegrationDoc {
    return {
        _id: String(doc._id),
        name: doc.name ?? '',
        provider: doc.provider ?? 'webhook',
        status: (doc.status as CrmIntegrationDoc['status']) ?? 'disconnected',
        isActive: !!doc.isActive,
        webhookUrl: doc.webhookUrl ?? undefined,
        config: (doc.config as Record<string, unknown>) ?? undefined,
        credentialsHidden: doc.credentialsEncrypted ? '***hidden***' : undefined,
        syncStatus: doc.syncStatus ?? undefined,
        lastSyncAt:
            doc.lastSyncAt instanceof Date
                ? doc.lastSyncAt.toISOString()
                : doc.lastSyncAt ?? undefined,
        createdAt:
            doc.createdAt instanceof Date
                ? doc.createdAt.toISOString()
                : doc.createdAt ?? undefined,
        updatedAt:
            doc.updatedAt instanceof Date
                ? doc.updatedAt.toISOString()
                : doc.updatedAt ?? undefined,
    };
}

/** Fetch a single integration doc by id (credentials redacted). */
export async function getIntegrationById(
    id: string,
): Promise<CrmIntegrationDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    
    try {
        if (!ObjectId.isValid(id)) return null;
        if (!ObjectId.isValid(session.user._id)) return null;
    } catch (e) {
        return null; // Handle malformed ID gracefully
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(INTEGRATIONS_COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return redact(doc);
    } catch (e) {
        console.error('[getIntegrationById] failed:', e);
        return null;
    }
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;
    try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        /* fall through */
    }
    return undefined;
}

/**
 * `useActionState`-compatible create/update for the integration form.
 * The plaintext `credentials` JSON is stored verbatim under
 * `credentialsEncrypted` — encryption at rest is the platform's
 * responsibility; the redaction in `getIntegrationById` makes sure the
 * value never crosses back over the wire.
 */
export async function saveIntegration(
    _prevState: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const integrationId =
        (formData.get('integrationId') as string | null) || undefined;
    const isEditing = !!integrationId;

    const name = (formData.get('name') as string | null)?.trim() || '';
    if (!name) return { error: 'Integration name is required.' };

    const provider =
        (formData.get('provider') as string | null)?.trim() || 'webhook';
    const isActive = formData.get('isActive') === 'on';
    const webhookUrl =
        (formData.get('webhookUrl') as string | null)?.trim() || undefined;
    const config = parseJsonObject(formData.get('config') as string | null);
    const credentialsRaw = (formData.get('credentials') as string | null) ?? '';
    const credentials = parseJsonObject(credentialsRaw);

    const now = new Date();
    const doc: Record<string, unknown> = {
        name,
        provider,
        isActive,
        status: isActive ? 'connected' : 'disconnected',
        webhookUrl,
        config,
        updatedAt: now,
    };
    // Only overwrite credentials when the form actually posted a non-empty
    // payload — blank means "keep existing secrets".
    if (credentialsRaw.trim()) {
        doc.credentialsEncrypted = credentials ?? {};
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        if (isEditing && ObjectId.isValid(integrationId)) {
            await db.collection(INTEGRATIONS_COLLECTION).updateOne(
                { _id: new ObjectId(integrationId), userId },
                { $set: doc },
            );
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${integrationId}`);
            return { message: 'Integration updated.', id: integrationId };
        }

        doc.userId = userId;
        doc.createdAt = now;
        const result = await db
            .collection(INTEGRATIONS_COLLECTION)
            .insertOne(doc as any);
        revalidatePath(BASE_PATH);
        return {
            message: 'Integration created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/** Flip the `isActive` flag on an integration. */
export async function setIntegrationActive(
    id: string,
    active: boolean,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid integration id.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(INTEGRATIONS_COLLECTION).updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(session.user._id) },
            {
                $set: {
                    isActive: active,
                    status: active ? 'connected' : 'disconnected',
                    updatedAt: new Date(),
                },
            },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Integration not found.' };
        }
        revalidatePath(BASE_PATH);
        revalidatePath(`${BASE_PATH}/${id}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Hard-delete an integration. */
export async function deleteIntegration(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid integration id.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(INTEGRATIONS_COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (result.deletedCount === 0) {
            return { success: false, error: 'Integration not found.' };
        }
        revalidatePath(BASE_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Get webhook logs for an integration */
export async function getWebhookLogs(integrationId: string) {
    const session = await getSession();
    if (!session?.user) return [];
    
    if (!ObjectId.isValid(integrationId)) return [];

    try {
        const { db } = await connectToDatabase();
        // Fallback to empty array if collection doesn't exist yet
        const logs = await db.collection('webhook_logs')
            .find({ integrationId: new ObjectId(integrationId), userId: new ObjectId(session.user._id) })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
            
        return logs.map(l => ({
            _id: String(l._id),
            status: l.status,
            method: l.method,
            payload: l.payload,
            response: l.response,
            timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
        }));
    } catch (e) {
        console.error('[getWebhookLogs] failed:', e);
        return [];
    }
}

export async function triggerManualSync(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  try {
    const { db } = await connectToDatabase();
    await db.collection(INTEGRATIONS_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          syncStatus: 'syncing',
          lastSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      }
    );

    revalidatePath(`${BASE_PATH}/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: getErrorMessage(err) };
  }
}
