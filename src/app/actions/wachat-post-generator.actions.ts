'use server';

/**
 * Wachat post-generator server actions.
 *
 * The `/wachat/post-generator` page is split in two:
 *
 *   - **AI generation** stays in the Next streaming route
 *     (`/wachat/post-generator/api`) — NOT touched here.
 *   - **Persistence + publish** (drafts list/save/delete, publish to the
 *     connected Facebook Page feed, WhatsApp-status intents, and the publish
 *     history) is owned by the Rust crate `wachat-post-generator`, mounted at
 *     `/v1/wachat/post-generator`.
 *
 * Each body is a thin shim around `wachatPostGeneratorApi.*` — unpack inputs,
 * delegate, normalise the response into a `{ ...; error? }` envelope the client
 * can branch on, and `revalidatePath()` the page so a server-rendered list
 * stays fresh.
 */

import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import {
    wachatPostGeneratorApi,
    type PostDraft,
    type PublishLogEntry,
    type PublishResponse,
} from '@/lib/rust-client/wachat-post-generator';

const PAGE_PATH = '/wachat/post-generator';

// ---------------------------------------------------------------------------
// Result envelopes — discriminated by the presence of `error`.
// ---------------------------------------------------------------------------

export interface ListDraftsResult {
    drafts?: PostDraft[];
    error?: string;
}

export interface SaveDraftResult {
    draft?: PostDraft;
    error?: string;
}

export interface DeleteDraftResult {
    success?: boolean;
    error?: string;
}

export interface PublishResult {
    result?: PublishResponse;
    error?: string;
}

export interface PublishLogResult {
    entries?: PublishLogEntry[];
    error?: string;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export async function getPostDrafts(projectId: string): Promise<ListDraftsResult> {
    if (!projectId) return { error: 'Select a project first.' };
    try {
        const r = await wachatPostGeneratorApi.listDrafts(projectId);
        return { drafts: r.drafts };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePostDraft(
    projectId: string,
    body: string,
    opts?: { title?: string; channel?: string },
): Promise<SaveDraftResult> {
    if (!projectId) return { error: 'Select a project first.' };
    if (!body.trim()) return { error: 'Draft body is required.' };
    try {
        const draft = await wachatPostGeneratorApi.saveDraft({
            projectId,
            body,
            title: opts?.title,
            channel: opts?.channel,
        });
        revalidatePath(PAGE_PATH);
        return { draft };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePostDraft(draftId: string): Promise<DeleteDraftResult> {
    if (!draftId) return { error: 'Missing draft id.' };
    try {
        const r = await wachatPostGeneratorApi.deleteDraft(draftId);
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Publish a suggestion to the project's connected Facebook Page feed. Pass
 * either inline `text` or a saved `draftId`. The Rust crate records a
 * publish-log row for every attempt (success or failure).
 */
export async function publishPostToFacebook(
    projectId: string,
    args: { text?: string; draftId?: string },
): Promise<PublishResult> {
    if (!projectId) return { error: 'Select a project first.' };
    if (!args.text?.trim() && !args.draftId) {
        return { error: 'Provide a draft or text to publish.' };
    }
    try {
        const result = await wachatPostGeneratorApi.publishFacebook({
            projectId,
            text: args.text,
            draftId: args.draftId,
        });
        revalidatePath(PAGE_PATH);
        return { result };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Record a WhatsApp-status publish intent. There is no Graph status-publish
 * API wired yet, so the crate persists the intent + a `queued` log row.
 */
export async function publishPostToWhatsappStatus(
    projectId: string,
    args: { text?: string; draftId?: string },
): Promise<PublishResult> {
    if (!projectId) return { error: 'Select a project first.' };
    if (!args.text?.trim() && !args.draftId) {
        return { error: 'Provide a draft or text to publish.' };
    }
    try {
        const result = await wachatPostGeneratorApi.publishWhatsappStatus({
            projectId,
            text: args.text,
            draftId: args.draftId,
        });
        revalidatePath(PAGE_PATH);
        return { result };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
// Publish history
// ---------------------------------------------------------------------------

export async function getPostPublishLog(projectId: string): Promise<PublishLogResult> {
    if (!projectId) return { error: 'Select a project first.' };
    try {
        const r = await wachatPostGeneratorApi.publishLog(projectId);
        return { entries: r.entries };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}
