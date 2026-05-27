'use server';

/**
 * SabNotebook — personal note-taking module.
 *
 * Server-action wrappers around the Rust crates that own the four
 * SabNotebook entities (`/v1/sabnotebook/{notebooks,sections,notes,attachments}`).
 * All field shapes mirror the Rust DTOs (camelCase). Failures bubble up as
 * `{ error }` to the caller; the UI surfaces them via toasts / inline errors.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    sabnotebookNotebooksApi,
    type SabnotebookNotebook,
    type SabnotebookNotebookCreateInput,
    type SabnotebookNotebookListParams,
    type SabnotebookNotebookListResponse,
    type SabnotebookNotebookUpdateInput,
} from '@/lib/rust-client/sabnotebook-notebooks';
import {
    sabnotebookSectionsApi,
    type SabnotebookSection,
    type SabnotebookSectionCreateInput,
    type SabnotebookSectionListParams,
    type SabnotebookSectionListResponse,
    type SabnotebookSectionUpdateInput,
} from '@/lib/rust-client/sabnotebook-sections';
import {
    sabnotebookNotesApi,
    type SabnotebookNote,
    type SabnotebookNoteCreateInput,
    type SabnotebookNoteListParams,
    type SabnotebookNoteListResponse,
    type SabnotebookNoteSearchParams,
    type SabnotebookNoteUpdateInput,
} from '@/lib/rust-client/sabnotebook-notes';

/**
 * The SabNotebook UI lives under the legacy sticky-notes route so existing
 * deep links (and the CRM sidebar) keep working. The notebooks/sections/notes
 * collections are namespaced (`sabnotebook_*`) and untouched by the legacy
 * sticky-notes Mongo collection. The "Quick Notes" notebook is a per-user
 * auto-notebook that absorbs the sticky-notes board surface.
 */
const BASE_PATH = '/dashboard/crm/workspace/sticky-notes';
const QUICK_NOTES_NAME = 'Quick Notes';
const QUICK_NOTES_COLOR = '#f59e0b';

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Notebooks ──────────────────────────────────────────────────────── */

export async function listSabnotebookNotebooks(
    params?: SabnotebookNotebookListParams,
): Promise<SabnotebookNotebookListResponse> {
    const empty: SabnotebookNotebookListResponse = {
        items: [],
        page: 0,
        limit: 50,
        hasMore: false,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        return await sabnotebookNotebooksApi.list(params);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[listSabnotebookNotebooks] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getSabnotebookNotebook(
    id: string,
): Promise<SabnotebookNotebook | null> {
    const session = await getSession();
    if (!session?.user || !id) return null;
    try {
        return await sabnotebookNotebooksApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSabnotebookNotebook] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

export async function createSabnotebookNotebook(
    input: SabnotebookNotebookCreateInput,
): Promise<{ id?: string; entity?: SabnotebookNotebook; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!input.name?.trim()) return { error: 'Name is required.' };
    try {
        const res = await sabnotebookNotebooksApi.create(input);
        revalidatePath(BASE_PATH);
        return { id: res.id, entity: res.entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'create',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function updateSabnotebookNotebook(
    id: string,
    patch: SabnotebookNotebookUpdateInput,
): Promise<{ entity?: SabnotebookNotebook; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!id) return { error: 'Notebook id is required.' };
    try {
        const entity = await sabnotebookNotebooksApi.update(id, patch);
        revalidatePath(BASE_PATH);
        revalidatePath(`${BASE_PATH}/${id}`);
        return { entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'update',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function deleteSabnotebookNotebook(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Notebook id is required.' };
    try {
        const res = await sabnotebookNotebooksApi.delete(id);
        revalidatePath(BASE_PATH);
        return { success: !!res.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: msg };
    }
}

/* ─── Sections ───────────────────────────────────────────────────────── */

export async function listSabnotebookSections(
    params?: SabnotebookSectionListParams,
): Promise<SabnotebookSectionListResponse> {
    const empty: SabnotebookSectionListResponse = {
        items: [],
        page: 0,
        limit: 100,
        hasMore: false,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        return await sabnotebookSectionsApi.list(params);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[listSabnotebookSections] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_section',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function createSabnotebookSection(
    input: SabnotebookSectionCreateInput,
): Promise<{ id?: string; entity?: SabnotebookSection; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!input.notebookId) return { error: 'notebookId is required.' };
    if (!input.name?.trim()) return { error: 'Name is required.' };
    try {
        const res = await sabnotebookSectionsApi.create(input);
        revalidatePath(`${BASE_PATH}/${input.notebookId}`);
        return { id: res.id, entity: res.entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_section',
            op: 'create',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function updateSabnotebookSection(
    id: string,
    patch: SabnotebookSectionUpdateInput,
    notebookId?: string,
): Promise<{ entity?: SabnotebookSection; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!id) return { error: 'Section id is required.' };
    try {
        const entity = await sabnotebookSectionsApi.update(id, patch);
        if (notebookId) revalidatePath(`${BASE_PATH}/${notebookId}`);
        return { entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_section',
            op: 'update',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function deleteSabnotebookSection(
    id: string,
    notebookId?: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Section id is required.' };
    try {
        const res = await sabnotebookSectionsApi.delete(id);
        if (notebookId) revalidatePath(`${BASE_PATH}/${notebookId}`);
        return { success: !!res.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_section',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: msg };
    }
}

/* ─── Notes ──────────────────────────────────────────────────────────── */

export async function listSabnotebookNotes(
    params?: SabnotebookNoteListParams,
): Promise<SabnotebookNoteListResponse> {
    const empty: SabnotebookNoteListResponse = {
        items: [],
        page: 0,
        limit: 50,
        hasMore: false,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        return await sabnotebookNotesApi.list(params);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[listSabnotebookNotes] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getSabnotebookNote(
    id: string,
): Promise<SabnotebookNote | null> {
    const session = await getSession();
    if (!session?.user || !id) return null;
    try {
        return await sabnotebookNotesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSabnotebookNote] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

export async function createSabnotebookNote(
    input: SabnotebookNoteCreateInput,
): Promise<{ id?: string; entity?: SabnotebookNote; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!input.sectionId) return { error: 'sectionId is required.' };
    try {
        const res = await sabnotebookNotesApi.create(input);
        if (input.notebookId) revalidatePath(`${BASE_PATH}/${input.notebookId}`);
        revalidatePath(BASE_PATH);
        return { id: res.id, entity: res.entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'create',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function updateSabnotebookNote(
    id: string,
    patch: SabnotebookNoteUpdateInput,
): Promise<{ entity?: SabnotebookNote; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!id) return { error: 'Note id is required.' };
    try {
        const entity = await sabnotebookNotesApi.update(id, patch);
        if (entity?.notebookId) revalidatePath(`${BASE_PATH}/${entity.notebookId}`);
        revalidatePath(BASE_PATH);
        return { entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'update',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function deleteSabnotebookNote(
    id: string,
    notebookId?: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Note id is required.' };
    try {
        const res = await sabnotebookNotesApi.delete(id);
        if (notebookId) revalidatePath(`${BASE_PATH}/${notebookId}`);
        revalidatePath(BASE_PATH);
        return { success: !!res.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: msg };
    }
}

export async function pinSabnotebookNote(
    id: string,
    pinned: boolean,
): Promise<{ entity?: SabnotebookNote; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!id) return { error: 'Note id is required.' };
    try {
        const entity = await sabnotebookNotesApi.pin(id, pinned);
        if (entity?.notebookId) revalidatePath(`${BASE_PATH}/${entity.notebookId}`);
        return { entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'update',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

export async function archiveSabnotebookNote(
    id: string,
    archived: boolean,
): Promise<{ entity?: SabnotebookNote; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!id) return { error: 'Note id is required.' };
    try {
        const entity = await sabnotebookNotesApi.archive(id, archived);
        if (entity?.notebookId) revalidatePath(`${BASE_PATH}/${entity.notebookId}`);
        return { entity };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'update',
            errorCode: code,
            status,
        });
        return { error: msg };
    }
}

/**
 * Returns (or lazily creates) the per-user "Quick Notes" notebook + its
 * default section. This is the destination for the legacy sticky-notes
 * board's "+ New note" entry point — every quick capture lands here.
 *
 * Returns `null` if the user is unauthenticated or the Rust service fails;
 * callers should fall back to the legacy sticky-notes collection only when
 * this returns `null`.
 */
export async function getOrCreateQuickNotesNotebook(): Promise<{
    notebook: SabnotebookNotebook;
    section: SabnotebookSection;
} | null> {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        // First, look for an existing Quick Notes notebook (case-insensitive
        // match on the well-known name).
        const list = await sabnotebookNotebooksApi.list({
            q: QUICK_NOTES_NAME,
            limit: 10,
            status: 'active',
        });
        let notebook = list.items.find(
            (n) => (n.name ?? '').trim().toLowerCase() === QUICK_NOTES_NAME.toLowerCase(),
        );
        if (!notebook) {
            const created = await sabnotebookNotebooksApi.create({
                name: QUICK_NOTES_NAME,
                color: QUICK_NOTES_COLOR,
                description:
                    'Your quick-capture board. Sticky notes you jot down land here.',
            });
            notebook = created.entity;
        }
        // Ensure at least one section exists; reuse the first if so.
        const sections = await sabnotebookSectionsApi.list({
            notebookId: notebook._id,
            limit: 1,
            status: 'active',
        });
        let section = sections.items[0];
        if (!section) {
            const created = await sabnotebookSectionsApi.create({
                notebookId: notebook._id,
                name: 'Inbox',
                order: 0,
                color: QUICK_NOTES_COLOR,
            });
            section = created.entity;
        }
        return { notebook, section };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOrCreateQuickNotesNotebook] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_notebook',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

export async function searchSabnotebookNotes(
    params: SabnotebookNoteSearchParams,
): Promise<SabnotebookNoteListResponse> {
    const empty: SabnotebookNoteListResponse = {
        items: [],
        page: 0,
        limit: 0,
        hasMore: false,
    };
    const session = await getSession();
    if (!session?.user) return empty;
    if (!params.q?.trim()) return empty;
    try {
        return await sabnotebookNotesApi.search(params);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[searchSabnotebookNotes] failed:', msg);
        recordRustFallback({
            entity: 'sabnotebook_note',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}
