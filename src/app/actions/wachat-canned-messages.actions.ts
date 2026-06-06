'use server';

/**
 * Server actions for the WaChat **canned messages** page
 * (`/wachat/settings/canned`).
 *
 * These delegate to the `wachat-canned-messages` Rust crate (mounted at
 * `/v1/wachat/canned-messages`) via the typed `wachatCannedMessagesApi`
 * rust-client namespace, which carries the session JWT. They REPLACE the old
 * native-Mongo `project.actions` path (collection `canned_messages`) — the
 * Rust crate owns its own `wa_canned_messages` + `wa_canned_message_settings`
 * collections, scoped to the authenticated user + project.
 *
 * NOTE: `wachatCannedMessagesApi` is imported directly here rather than through
 * `@/lib/rust-client` — the central barrel registers the namespace separately.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatCannedMessagesApi,
    type CannedMessageDoc,
    type CannedMessageType,
    type SaveCannedMessageBody,
} from '@/lib/rust-client/wachat-canned-messages';
import { getErrorMessage } from '@/lib/utils';

const PAGE_PATH = '/wachat/settings/canned';

const VALID_TYPES: readonly CannedMessageType[] = [
    'text',
    'image',
    'video',
    'audio',
    'document',
];

// ---------------------------------------------------------------------------
// Result shapes (mirror the legacy `project.actions` canned contracts so the
// existing callers keep working unchanged).
// ---------------------------------------------------------------------------

export interface ListCannedMessagesResult {
    messages?: CannedMessageDoc[];
    error?: string;
}

export interface SaveCannedMessageResult {
    message?: string;
    error?: string;
}

export interface DeleteCannedMessageResult {
    success: boolean;
    error?: string;
}

export interface CannedSettingsResult {
    syncAcrossProjects?: boolean;
    keyboardTrigger?: string;
    error?: string;
}

export interface SaveCannedSettingsResult {
    success: boolean;
    error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate the shared create/update form payload and build the wire body.
 * Returns either the body or a human-readable error string.
 */
function buildSaveBody(
    name: string | null,
    rawType: string | null,
    text: string | null,
    mediaUrl: string | null,
    caption: string | null,
    fileName: string | null,
    isFavourite: boolean,
): { body: SaveCannedMessageBody } | { error: string } {
    const trimmedName = (name ?? '').trim();
    if (!trimmedName) return { error: 'Name is required.' };

    const type = (rawType ?? '') as CannedMessageType;
    if (!VALID_TYPES.includes(type)) {
        return {
            error: 'Type must be one of: text, image, video, audio, document.',
        };
    }

    const body: SaveCannedMessageBody = {
        name: trimmedName,
        type,
        isFavourite,
    };

    if (type === 'text') {
        const trimmedText = (text ?? '').trim();
        if (!trimmedText) {
            return { error: 'Text content is required for text messages.' };
        }
        body.text = trimmedText;
    } else {
        const trimmedUrl = (mediaUrl ?? '').trim();
        if (!trimmedUrl) {
            return { error: 'Media URL is required for media messages.' };
        }
        body.mediaUrl = trimmedUrl;
        const trimmedCaption = (caption ?? '').trim();
        if (trimmedCaption) body.caption = trimmedCaption;
        const trimmedFileName = (fileName ?? '').trim();
        if (trimmedFileName) body.fileName = trimmedFileName;
    }

    return { body };
}

// ---------------------------------------------------------------------------
// Canned messages CRUD
// ---------------------------------------------------------------------------

export async function getCannedMessages(
    projectId: string,
): Promise<ListCannedMessagesResult> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatCannedMessagesApi.list(projectId);
        return { messages: r.messages };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Create or update a canned message from the form-dialog `FormData`.
 * When `_id` is present the message is updated, otherwise created.
 */
export async function saveCannedMessage(
    _prevState: unknown,
    formData: FormData,
): Promise<SaveCannedMessageResult> {
    const projectId = (formData.get('projectId') as string | null) ?? '';
    if (!projectId) return { error: 'Project ID is missing.' };

    const messageId = formData.get('_id') as string | null;

    const built = buildSaveBody(
        formData.get('name') as string | null,
        formData.get('type') as string | null,
        formData.get('text') as string | null,
        formData.get('mediaUrl') as string | null,
        formData.get('caption') as string | null,
        formData.get('fileName') as string | null,
        formData.get('isFavourite') === 'on',
    );
    if ('error' in built) return { error: built.error };

    try {
        if (messageId) {
            await wachatCannedMessagesApi.update(projectId, messageId, built.body);
        } else {
            await wachatCannedMessagesApi.create(projectId, built.body);
        }
        revalidatePath(PAGE_PATH);
        return { message: 'Canned message saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCannedMessage(
    messageId: string,
): Promise<DeleteCannedMessageResult> {
    if (!messageId) return { success: false, error: 'Message ID is required.' };
    try {
        const r = await wachatCannedMessagesApi.remove(messageId);
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Per-project canned-message settings
// ---------------------------------------------------------------------------

export async function getCannedSettings(
    projectId: string,
): Promise<CannedSettingsResult> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatCannedMessagesApi.getSettings(projectId);
        return {
            syncAcrossProjects: r.syncAcrossProjects,
            keyboardTrigger: r.keyboardTrigger,
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCannedSettings(
    projectId: string,
    syncAcrossProjects: boolean,
    keyboardTrigger: string | null,
): Promise<SaveCannedSettingsResult> {
    if (!projectId) return { success: false, error: 'Project ID is required.' };
    try {
        const r = await wachatCannedMessagesApi.updateSettings(projectId, {
            syncAcrossProjects,
            keyboardTrigger: keyboardTrigger && keyboardTrigger.trim()
                ? keyboardTrigger.trim()
                : null,
        });
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
