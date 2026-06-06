'use server';

/**
 * Server Actions for the Wachat WhatsApp template surface.
 *
 * Every function in this file is a thin shim that:
 *
 *   1. Translates the legacy Server Action input shape (positional args
 *      or `FormData`) into the JSON request body the
 *      `wachatTemplatesActions` Rust namespace expects.
 *   2. Forwards the call to `rustClient.wachatTemplatesActions.*`.
 *   3. Calls `revalidatePath(...)` for any view that lists templates.
 *
 * The Rust handler returns the action-state-shaped response
 * (`{ message?, error?, … }`) verbatim, so this file does no result
 * massaging beyond constructing the user-facing string for actions
 * whose message text depends on counts (e.g. bulk create).
 */

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import type { Template, CreateTemplateState } from '@/lib/definitions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getSession } from './user.actions';

async function _wachatTplActorId(): Promise<string | null> {
    try {
        const session = await getSession();
        const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
        const raw = u?._id ?? u?.id;
        if (!raw) return null;
        return typeof raw === 'string' ? raw : String(raw);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// FormData helpers — keep the legacy `(prevState, formData)` signatures.
// ---------------------------------------------------------------------------

function strField(fd: FormData, key: string): string | undefined {
    const v = fd.get(key);
    if (v == null) return undefined;
    const s = String(v);
    return s === '' ? undefined : s;
}

function jsonField<T>(fd: FormData, key: string): T | undefined {
    const raw = strField(fd, key);
    if (raw == null) return undefined;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function listField(fd: FormData, key: string): string[] {
    const raw = strField(fd, key);
    if (!raw) return [];
    // Accept JSON array or comma-separated.
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
        /* fall through */
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!projectId) return [];
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const list = await rustClient.wachatTemplatesActions.list(projectId);
        return list as unknown as WithId<Template>[];
    } catch (e) {
        console.error('Failed to fetch templates:', e);
        return [];
    }
}

export async function getLibraryTemplates() {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const list = await rustClient.wachatTemplatesActions.libraryList();
        return list as unknown as any[];
    } catch (e) {
        console.error('Failed to fetch library templates:', e);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function handleSyncTemplates(
    projectId: string,
): Promise<{ message?: string; error?: string; count?: number }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.sync({ projectId });
        revalidatePath('/wachat/templates');
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'Sync failed' };
    }
}

// ---------------------------------------------------------------------------
// Create / Edit / Delete
// ---------------------------------------------------------------------------

export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData,
): Promise<CreateTemplateState> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.create({
            projectId: strField(formData, 'projectId') ?? '',
            name: strField(formData, 'name') ?? '',
            language: strField(formData, 'language') ?? '',
            category: (strField(formData, 'category') as any) ?? 'UTILITY',
            body: strField(formData, 'body') ?? '',
            bodyExamples: jsonField<string[]>(formData, 'bodyExamples') ?? [],
            footer: strField(formData, 'footer'),
            headerFormat: (strField(formData, 'headerFormat') as any) ?? 'NONE',
            headerText: strField(formData, 'headerText'),
            headerExample: strField(formData, 'headerExample'),
            headerMediaUrl: strField(formData, 'headerMediaUrl'),
            buttons: jsonField<unknown[]>(formData, 'buttons') ?? [],
            allowCategoryChange:
                strField(formData, 'allowCategoryChange') !== 'false',
        });
        revalidatePath('/wachat/templates');
        if (!r.error) {
            const actor = await _wachatTplActorId();
            if (actor) {
                void recordFlowAction('wachat.template.created', {
                    userId: actor,
                    target: (r as { metaTemplateId?: string; id?: string }).metaTemplateId
                        ?? (r as { id?: string }).id,
                    metadata: {
                        projectId: strField(formData, 'projectId'),
                        name: strField(formData, 'name'),
                        language: strField(formData, 'language'),
                        category: strField(formData, 'category'),
                    },
                });
            }
        }
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleBulkCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData,
): Promise<CreateTemplateState> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.bulkCreate({
            projectIds: listField(formData, 'projectIds'),
            name: strField(formData, 'name') ?? '',
            language: strField(formData, 'language') ?? '',
            category: (strField(formData, 'category') as any) ?? 'UTILITY',
            body: strField(formData, 'body') ?? '',
            bodyExamples: jsonField<string[]>(formData, 'bodyExamples') ?? [],
            footer: strField(formData, 'footer'),
            headerFormat: (strField(formData, 'headerFormat') as any) ?? 'NONE',
            headerText: strField(formData, 'headerText'),
            headerExample: strField(formData, 'headerExample'),
            headerMediaUrl: strField(formData, 'headerMediaUrl'),
            buttons: jsonField<unknown[]>(formData, 'buttons') ?? [],
            allowCategoryChange:
                strField(formData, 'allowCategoryChange') !== 'false',
        });
        revalidatePath('/wachat/templates');
        if (r.error) return { error: r.error };
        const applied = r.applied ?? r.successes ?? 0;
        const skipped = r.skipped ?? 0;
        let message = `Template saved as 'LOCAL' for ${applied} project(s). They will be submitted by the next cron run.`;
        if (skipped > 0) message += ` Skipped ${skipped} project(s) (no access).`;
        return { message };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleCreateFlowTemplate(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.createFlow({
            projectId: strField(formData, 'projectId') ?? '',
            flowId: strField(formData, 'flowId') ?? '',
            templateName: strField(formData, 'templateName') ?? '',
            language: strField(formData, 'language') ?? '',
            category: (strField(formData, 'category') as any) ?? 'UTILITY',
            bodyText: strField(formData, 'bodyText') ?? '',
            buttonText: strField(formData, 'buttonText') ?? '',
        });
        revalidatePath('/wachat/templates');
        if (r.error) return { error: r.error };
        return {
            message: `Template "${r.name ?? ''}" created successfully and is now pending approval.`,
        };
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleEditTemplate(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    try {
        const metaTemplateId = formData.get('metaTemplateId') as string;
        if (!metaTemplateId) return { error: 'Meta Template ID is required.' };
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.edit({
            projectId: strField(formData, 'projectId') ?? '',
            metaTemplateId,
            category: strField(formData, 'category') as any,
            headerFormat: strField(formData, 'headerFormat') as any,
            headerText: strField(formData, 'headerText'),
            headerMediaUrl: strField(formData, 'headerMediaUrl'),
            body: strField(formData, 'body'),
            bodyExamples: jsonField<string[]>(formData, 'bodyExamples'),
            footer: strField(formData, 'footer'),
            buttons: jsonField<unknown[]>(formData, 'buttons'),
        });
        revalidatePath('/wachat/templates');
        if (!r.error) {
            const actor = await _wachatTplActorId();
            if (actor) {
                void recordFlowAction('wachat.template.updated', {
                    userId: actor,
                    target: formData.get('metaTemplateId') as string,
                    metadata: {
                        projectId: strField(formData, 'projectId'),
                        category: strField(formData, 'category'),
                    },
                });
            }
        }
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleDeleteTemplate(
    projectId: string,
    templateName: string,
    metaTemplateId?: string,
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.deleteByName({
            projectId,
            templateName,
            metaTemplateId,
        });
        revalidatePath('/wachat/templates');
        if (!r.error) {
            const actor = await _wachatTplActorId();
            if (actor) {
                void recordFlowAction('wachat.template.deleted', {
                    userId: actor,
                    target: metaTemplateId ?? templateName,
                    metadata: { projectId, templateName },
                });
            }
        }
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleDeleteTemplateById(
    projectId: string,
    metaTemplateId: string,
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.deleteById({
            projectId,
            metaTemplateId,
        });
        revalidatePath('/wachat/templates');
        if (!r.error) {
            const actor = await _wachatTplActorId();
            if (actor) {
                void recordFlowAction('wachat.template.deleted', {
                    userId: actor,
                    target: metaTemplateId,
                    metadata: { projectId },
                });
            }
        }
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export async function saveLibraryTemplate(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.librarySave({
            name: strField(formData, 'name') ?? '',
            category: (strField(formData, 'category') as any) ?? 'UTILITY',
            language: strField(formData, 'language') ?? '',
            body: strField(formData, 'body') ?? '',
            components: jsonField<unknown>(formData, 'components') ?? [],
        });
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/wachat/templates/library');
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function deleteLibraryTemplate(
    id: string,
): Promise<{ message?: string; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.libraryDelete(id);
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/wachat/templates/library');
        return r;
    } catch (e: any) {
        return { error: e?.message ?? 'An unexpected error occurred.' };
    }
}

export async function handleApplyTemplateToProjects(
    sourceTemplateId: string,
    targetProjectIds: string[],
): Promise<{ success: boolean; error?: string; applied?: number; skipped?: number }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.libraryApply(
            sourceTemplateId,
            { targetProjectIds },
        );
        revalidatePath('/wachat/templates');
        return r;
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'An unexpected error occurred.' };
    }
}

// ---------------------------------------------------------------------------
// Multi-language clone (Wave E)
// ---------------------------------------------------------------------------

/** Input for {@link handleCloneTemplateMultilang}. Identify the source by id or name. */
export interface CloneTemplateMultilangInput {
    projectId: string;
    sourceTemplateId?: string;
    sourceTemplateName?: string;
    targetLanguages: string[];
}

/** Per-language outcome — mirrors the Rust `CloneOutcome` (camelCase wire shape). */
export interface CloneTemplateOutcome {
    language: string;
    status: 'created' | 'failed' | 'skipped';
    error?: string;
    metaId?: string;
}

/**
 * Result of {@link handleCloneTemplateMultilang}. On a whole-request failure
 * (bad project, missing source, empty target list) `error` is set and the
 * other fields are absent; otherwise the per-language `outcomes` array is
 * returned along with the resolved source echo and counts.
 */
export interface CloneTemplateMultilangResult {
    error?: string;
    sourceName?: string;
    sourceLanguage?: string;
    created?: number;
    failed?: number;
    outcomes?: CloneTemplateOutcome[];
}

/**
 * Clone an already-created template into additional languages via Meta.
 *
 * Thin shim over `wachatTemplatesActions.cloneMultilang`. Whole-request
 * validation failures throw in the Rust client and are folded into
 * `{ error }`; per-language failures (e.g. absent Meta creds) come back as
 * `status: 'failed'` rows inside `outcomes`, so the UI degrades gracefully.
 */
export async function handleCloneTemplateMultilang(
    input: CloneTemplateMultilangInput,
): Promise<CloneTemplateMultilangResult> {
    if (!input.projectId) return { error: 'A project is required.' };
    if (!input.sourceTemplateId && !input.sourceTemplateName) {
        return { error: 'A source template id or name is required.' };
    }
    const targetLanguages = (input.targetLanguages ?? [])
        .map((l) => l.trim())
        .filter(Boolean);
    if (targetLanguages.length === 0) {
        return { error: 'Select at least one target language.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatTemplatesActions.cloneMultilang({
            projectId: input.projectId,
            sourceTemplateId: input.sourceTemplateId,
            sourceTemplateName: input.sourceTemplateName,
            targetLanguages,
        });
        revalidatePath('/wachat/templates');
        if (r.created > 0) {
            const actor = await _wachatTplActorId();
            if (actor) {
                void recordFlowAction('wachat.template.created', {
                    userId: actor,
                    target: input.sourceTemplateName ?? input.sourceTemplateId,
                    metadata: {
                        projectId: input.projectId,
                        multilang: true,
                        created: r.created,
                        failed: r.failed,
                        languages: r.outcomes
                            .filter((o) => o.status === 'created')
                            .map((o) => o.language),
                    },
                });
            }
        }
        return {
            sourceName: r.sourceName,
            sourceLanguage: r.sourceLanguage,
            created: r.created,
            failed: r.failed,
            outcomes: r.outcomes,
        };
    } catch (e: any) {
        return { error: e?.message ?? 'Multi-language clone failed.' };
    }
}
