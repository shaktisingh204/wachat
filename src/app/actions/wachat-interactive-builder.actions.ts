'use server';

/**
 * Server actions for the WaChat interactive-message builder.
 *
 * These back the saved-template CRUD on
 * `/wachat/templates/interactive-message-builder`, which previously lived only
 * in `localStorage`. The Rust crate `wachat-interactive-builder` (mounted at
 * `/v1/wachat/interactive-builder`) owns the Mongo CRUD over
 * `wa_interactive_templates`, scoped to the authenticated user + `projectId`.
 *
 * The api namespace is imported DIRECTLY from the rust-client module here; it is
 * registered on the central `rustClient` barrel separately.
 */

import { revalidatePath } from 'next/cache';

import {
    wachatInteractiveBuilderApi,
    type InteractiveTemplateRecord,
    type SaveInteractiveTemplateBody,
} from '@/lib/rust-client/wachat-interactive-builder';
import { getErrorMessage } from '@/lib/utils';

const PAGE_PATH = '/wachat/templates/interactive-message-builder';

/** Shape returned to the client for a saved template. */
export interface InteractiveTemplate {
    id: string;
    name: string;
    /** Free-form interactive-message state persisted verbatim. */
    payload: unknown;
    createdAt?: string;
}

function toClientTemplate(doc: InteractiveTemplateRecord): InteractiveTemplate {
    return {
        id: doc._id,
        name: doc.name,
        payload: doc.payload,
        createdAt: doc.createdAt,
    };
}

/**
 * List the caller's saved interactive templates for a project.
 */
export async function getInteractiveTemplates(
    projectId: string,
): Promise<{ templates?: InteractiveTemplate[]; error?: string }> {
    if (!projectId) return { error: 'Project ID is required.' };
    try {
        const r = await wachatInteractiveBuilderApi.listTemplates(projectId);
        return { templates: (r.templates ?? []).map(toClientTemplate) };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Save a new named interactive-message layout. Returns the created template.
 */
export async function saveInteractiveTemplate(
    projectId: string,
    name: string,
    payload: unknown,
): Promise<{ template?: InteractiveTemplate; error?: string }> {
    if (!projectId) return { error: 'Project ID is required.' };
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Template name is required.' };
    try {
        const body: SaveInteractiveTemplateBody = {
            projectId,
            name: trimmed,
            payload,
        };
        const doc = await wachatInteractiveBuilderApi.saveTemplate(body);
        revalidatePath(PAGE_PATH);
        return { template: toClientTemplate(doc) };
    } catch (e: unknown) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Delete a saved template the caller owns.
 */
export async function deleteInteractiveTemplate(
    templateId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!templateId) return { success: false, error: 'Template ID is required.' };
    try {
        const r = await wachatInteractiveBuilderApi.deleteTemplate(templateId);
        revalidatePath(PAGE_PATH);
        return { success: r.success };
    } catch (e: unknown) {
        return { success: false, error: getErrorMessage(e) };
    }
}
