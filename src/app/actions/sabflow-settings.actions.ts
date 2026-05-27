'use server';

/**
 * Server actions for SabFlow module-level settings.
 *
 * Settings live in `module_settings` keyed by (userId, module='sabflow').
 * Each section is patched independently from the client and merged into
 * the existing settings object. Returns `{ settings?, error? }` envelopes.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { z } from 'zod';

const MODULE = 'sabflow' as const;
const COLLECTION = 'module_settings';

type SabflowDefaults = {
    defaultWorkspace: string;
    executionTimeout: number;
};

type SabflowRetention = {
    keepRunHistoryDays: number;
    purgeFailedRuns: boolean;
};

type SabflowRunLimits = {
    maxConcurrentRuns: number;
    maxStepsPerRun: number;
};

type SabflowWebhooks = {
    url: string;
    secret: string;
    retryAttempts: number;
};

type SabflowVariableEntry = {
    key: string;
    value: string;
};

type SabflowSettings = {
    defaults: SabflowDefaults;
    retention: SabflowRetention;
    runLimits: SabflowRunLimits;
    webhooks: SabflowWebhooks;
    variables: SabflowVariableEntry[];
    updatedAt?: string;
};

import { sabflowSettingsSchema } from './sabflow-settings.schema';

const DEFAULTS: SabflowSettings = {
    defaults: {
        defaultWorkspace: '',
        executionTimeout: 300,
    },
    retention: {
        keepRunHistoryDays: 30,
        purgeFailedRuns: false,
    },
    runLimits: {
        maxConcurrentRuns: 10,
        maxStepsPerRun: 100,
    },
    webhooks: {
        url: '',
        secret: '',
        retryAttempts: 3,
    },
    variables: [],
};

function mergeWithDefaults(stored: Partial<SabflowSettings> | null | undefined): SabflowSettings {
    return {
        defaults: { ...DEFAULTS.defaults, ...(stored?.defaults || {}) },
        retention: { ...DEFAULTS.retention, ...(stored?.retention || {}) },
        runLimits: { ...DEFAULTS.runLimits, ...(stored?.runLimits || {}) },
        webhooks: { ...DEFAULTS.webhooks, ...(stored?.webhooks || {}) },
        variables: Array.isArray(stored?.variables) ? stored!.variables! : DEFAULTS.variables,
        updatedAt: stored?.updatedAt,
    };
}

export async function getSabflowSettings(): Promise<{
    settings?: SabflowSettings;
    error?: string;
}> {
    try {
        const session = await getSession();
        if (!session?.user) return { error: 'Unauthorized' };

        const { db } = await connectToDatabase();
        const row = await db.collection(COLLECTION).findOne({
            userId: new ObjectId(session.user._id),
            module: MODULE,
        });

        const settings = mergeWithDefaults(row?.settings as Partial<SabflowSettings> | undefined);
        if (row?.updatedAt instanceof Date) {
            settings.updatedAt = row.updatedAt.toISOString();
        }
        return { settings };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to load settings' };
    }
}

export async function saveSabflowSettings(patch: Partial<SabflowSettings>): Promise<{
    settings?: SabflowSettings;
    error?: string;
}> {
    try {
        const session = await getSession();
        if (!session?.user) return { error: 'Unauthorized' };

        const parseResult = sabflowSettingsSchema.safeParse(patch);
        if (!parseResult.success) {
            return { error: parseResult.error.errors[0].message };
        }

        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const current = await db.collection(COLLECTION).findOne({ userId, module: MODULE });
        const currentSettings = mergeWithDefaults(
            current?.settings as Partial<SabflowSettings> | undefined,
        );

        const next: SabflowSettings = {
            ...currentSettings,
            ...patch,
            defaults: { ...currentSettings.defaults, ...(patch.defaults || {}) },
            retention: { ...currentSettings.retention, ...(patch.retention || {}) },
            runLimits: { ...currentSettings.runLimits, ...(patch.runLimits || {}) },
            webhooks: { ...currentSettings.webhooks, ...(patch.webhooks || {}) },
            variables: patch.variables ?? currentSettings.variables,
        };

        const updatedAt = new Date();
        await db.collection(COLLECTION).updateOne(
            { userId, module: MODULE },
            {
                $set: {
                    settings: { ...next, updatedAt: undefined },
                    updatedAt,
                },
                $setOnInsert: { userId, module: MODULE, createdAt: updatedAt },
            },
            { upsert: true },
        );

        revalidatePath('/dashboard/sabflow/settings');
        return { settings: { ...next, updatedAt: updatedAt.toISOString() } };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to save settings' };
    }
}

export async function testSabflowWebhook(url: string, secret: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const session = await getSession();
        if (!session?.user) return { error: 'Unauthorized' };

        if (!url) return { error: 'No URL provided' };
        
        try {
            z.string().url().parse(url);
        } catch {
            return { error: 'Must be a valid URL' };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(secret ? { 'x-sabflow-signature': secret } : {})
            },
            body: JSON.stringify({ event: 'test', message: 'This is a test webhook from SabNode SabFlow.' })
        });
        
        if (!res.ok) {
            return { error: `Endpoint returned status ${res.status}` };
        }
        
        return { success: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Test request failed' };
    }
}
