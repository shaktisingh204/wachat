'use server';

/**
 * Server actions for the WhatsApp chat **kanban** board
 * (`/wachat/chat/kanban`).
 *
 * These replace the native-mongo `getKanbanData` / `saveKanbanStatuses` from
 * `@/app/actions/project.actions` with the contacts-domain Rust BFF endpoints
 * (`wachat-contacts` crate):
 *
 *   GET  /v1/contacts/kanban          → getChatKanbanData
 *   POST /v1/contacts/kanban/statuses → saveChatKanbanStatuses
 *
 * Per-card *status moves* are NOT handled here — those keep persisting through
 * `handleUpdateContactStatus` (`PATCH /v1/contacts/{id}/status`).
 *
 * The board consumes `{ name, contacts }` columns (`KanbanColumnData`), so the
 * adapter maps the Rust column shape `{ id, title, contacts }` → `{ name:
 * title, contacts }`. Column ordering / bucketing is already done Rust-side
 * (defaults first, then deduped custom statuses), so this layer is a thin
 * tenancy-guarded shim.
 */

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import type { Contact, KanbanColumnData } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { rustClient, RustApiError } from '@/lib/rust-client';

/**
 * Result of {@link getChatKanbanData}. `projectId` echoes the requested scope
 * so the board can drive `saveChatKanbanStatuses` without re-reading
 * localStorage; it is `null` only when the load failed or no project was
 * supplied (the board renders the empty / error state in that case).
 */
export interface ChatKanbanData {
    projectId: string | null;
    columns: KanbanColumnData[];
    error?: string;
}

/**
 * Load the contacts-domain kanban board for a project (optionally scoped to a
 * single connected phone number).
 *
 * Mirrors the legacy `getKanbanData(projectId)` contract closely enough for
 * the board to consume unchanged, but sources columns from Rust.
 */
export async function getChatKanbanData(
    projectId: string,
    phoneNumberId?: string,
): Promise<ChatKanbanData> {
    const session = await getSession();
    if (!session?.user) {
        return { projectId: null, columns: [], error: 'Authentication required.' };
    }

    if (!projectId) {
        return { projectId: null, columns: [], error: 'Project ID is required.' };
    }

    try {
        const result = await rustClient.wachatContacts.getKanban(
            projectId,
            phoneNumberId,
        );

        // Map the Rust column shape ({ id, title, contacts }) onto the shape
        // the board consumes ({ name, contacts }). The slug (`id`) is what the
        // move handler writes back via PATCH /{id}/status, and `title` mirrors
        // it 1:1 today — the board keys columns on `name`, so use `title`.
        const columns: KanbanColumnData[] = (result.columns ?? []).map(
            (col) => ({
                name: col.title,
                contacts: (col.contacts ?? []) as WithId<Contact>[],
            }),
        );

        return { projectId, columns };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { projectId: null, columns: [], error: e.message };
        }
        console.error('Failed to get chat kanban data:', e);
        return {
            projectId: null,
            columns: [],
            error: getErrorMessage(e),
        };
    }
}

/**
 * Persist the board's custom column list onto the project. Mirrors the legacy
 * `saveKanbanStatuses(projectId, statuses)` — the caller posts the full set of
 * column names currently on the board; Rust strips the defaults before writing
 * only the user-added lists to `projects.kanbanStatuses`.
 */
export async function saveChatKanbanStatuses(
    projectId: string,
    statuses: string[],
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!projectId) {
        return { success: false, error: 'Project ID is required.' };
    }

    try {
        await rustClient.wachatContacts.saveKanbanStatuses(projectId, statuses);
        revalidatePath('/wachat/chat/kanban');
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { success: false, error: e.message };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}
