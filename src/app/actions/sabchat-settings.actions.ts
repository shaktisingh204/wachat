'use server';

/**
 * Server actions for SabChat module-level settings.
 *
 * Settings live in `module_settings` keyed by (userId, module='sabchat').
 * Each section is patched independently from the client and merged into
 * the existing settings object. Returns `{ settings?, error? }` envelopes.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

const MODULE = 'sabchat' as const;
const COLLECTION = 'module_settings';

type SabchatChannelDefaults = {
    defaultSender: string;
    autoTranslate: boolean;
};

type SabchatWorkingHours = {
    timezone: string;
    start: string;
    end: string;
    days: string[];
};

type SabchatAutoresponder = {
    enabled: boolean;
    message: string;
};

type SabchatRouting = {
    defaultAssignee: string;
    roundRobin: boolean;
};

type SabchatWebhooks = {
    url: string;
    secret: string;
};

type SabchatNotifications = {
    newMessage: boolean;
    escalation: boolean;
    agentMention: boolean;
};

type SabchatSettings = {
    channels: SabchatChannelDefaults;
    workingHours: SabchatWorkingHours;
    autoresponder: SabchatAutoresponder;
    routing: SabchatRouting;
    webhooks: SabchatWebhooks;
    notifications: SabchatNotifications;
    updatedAt?: string;
};

const DEFAULTS: SabchatSettings = {
    channels: {
        defaultSender: '',
        autoTranslate: false,
    },
    workingHours: {
        timezone: 'Asia/Kolkata',
        start: '09:00',
        end: '18:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
    autoresponder: {
        enabled: false,
        message: 'Thanks for reaching out! Our team will reply shortly.',
    },
    routing: {
        defaultAssignee: 'unassigned',
        roundRobin: false,
    },
    webhooks: {
        url: '',
        secret: '',
    },
    notifications: {
        newMessage: true,
        escalation: true,
        agentMention: true,
    },
};

function mergeWithDefaults(stored: Partial<SabchatSettings> | null | undefined): SabchatSettings {
    return {
        channels: { ...DEFAULTS.channels, ...(stored?.channels || {}) },
        workingHours: { ...DEFAULTS.workingHours, ...(stored?.workingHours || {}) },
        autoresponder: { ...DEFAULTS.autoresponder, ...(stored?.autoresponder || {}) },
        routing: { ...DEFAULTS.routing, ...(stored?.routing || {}) },
        webhooks: { ...DEFAULTS.webhooks, ...(stored?.webhooks || {}) },
        notifications: { ...DEFAULTS.notifications, ...(stored?.notifications || {}) },
        updatedAt: stored?.updatedAt,
    };
}

export async function getSabchatSettings(): Promise<{
    settings?: SabchatSettings;
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

        const settings = mergeWithDefaults(row?.settings as Partial<SabchatSettings> | undefined);
        if (row?.updatedAt instanceof Date) {
            settings.updatedAt = row.updatedAt.toISOString();
        }
        return { settings };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to load settings' };
    }
}

export async function saveSabchatSettings(patch: Partial<SabchatSettings>): Promise<{
    settings?: SabchatSettings;
    error?: string;
}> {
    try {
        const session = await getSession();
        if (!session?.user) return { error: 'Unauthorized' };

        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const current = await db.collection(COLLECTION).findOne({ userId, module: MODULE });
        const currentSettings = mergeWithDefaults(
            current?.settings as Partial<SabchatSettings> | undefined,
        );

        const next: SabchatSettings = {
            ...currentSettings,
            ...patch,
            channels: { ...currentSettings.channels, ...(patch.channels || {}) },
            workingHours: { ...currentSettings.workingHours, ...(patch.workingHours || {}) },
            autoresponder: { ...currentSettings.autoresponder, ...(patch.autoresponder || {}) },
            routing: { ...currentSettings.routing, ...(patch.routing || {}) },
            webhooks: { ...currentSettings.webhooks, ...(patch.webhooks || {}) },
            notifications: { ...currentSettings.notifications, ...(patch.notifications || {}) },
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

        revalidatePath('/dashboard/sabchat/settings');
        return { settings: { ...next, updatedAt: updatedAt.toISOString() } };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to save settings' };
    }
}
