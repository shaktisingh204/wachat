/**
 * Client for the Wachat **templates-actions** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/templates-actions` by
 * the `wachat-templates-actions` crate. Each method returns the Server
 * Action contract shape (`{ message?, error? }` etc.) verbatim — the
 * caller in `src/app/actions/template.actions.ts` is one line per
 * function.
 *
 *   GET    /list                                 → list (query: project_id)
 *   POST   /sync                                 → sync
 *   POST   /create                               → create
 *   POST   /bulk-create                          → bulkCreate
 *   POST   /create-flow                          → createFlow
 *   POST   /edit                                 → edit
 *   POST   /delete-by-name                       → deleteByName
 *   POST   /delete-by-id                         → deleteById
 *
 *   GET    /library/list                         → libraryList
 *   POST   /library/save                         → librarySave
 *   POST   /library/{id}/delete                  → libraryDelete
 *   POST   /library/{id}/apply                   → libraryApply
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';
import type { RustTemplate, RustLibraryTemplate } from './templates';

const BASE = '/v1/wachat/templates-actions';

// ---------------------------------------------------------------------------
// Action-state envelopes (`{ message?, error?, … }` — exact wire shape).
// ---------------------------------------------------------------------------

/** Generic Server Action result. */
export interface ActionState {
    message?: string;
    error?: string;
}

/** Result of `POST /sync` — adds an explicit `count` of upserted rows. */
export interface SyncActionResult extends ActionState {
    count?: number;
}

/** Result of `POST /bulk-create`. */
export interface BulkCreateActionResult {
    error?: string;
    applied?: number;
    skipped?: number;
    successes?: number;
}

/** Result of `POST /create-flow` — carries the created template name. */
export interface CreateFlowActionResult {
    error?: string;
    name?: string;
}

/** Result of `POST /library/{id}/apply` — exact TS server-action shape. */
export interface ApplyActionResult {
    success: boolean;
    error?: string;
    applied?: number;
    skipped?: number;
}

// ---------------------------------------------------------------------------
// Request bodies (camelCase JSON over the wire).
// ---------------------------------------------------------------------------

/** Body for `POST /sync`. */
export interface SyncBody {
    projectId: string;
}

/** Body shared by `POST /create` and the per-project bulk variant. */
export interface CreateActionBody {
    projectId: string;
    name: string;
    language: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | 'INTERACTIVE';
    body: string;
    bodyExamples?: string[];
    footer?: string;
    headerFormat: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
    headerText?: string;
    headerExample?: string;
    headerMediaUrl?: string;
    buttons?: unknown[];
    allowCategoryChange?: boolean;
}

/** Body for `POST /bulk-create`. */
export interface BulkCreateActionBody {
    projectIds: string[];
    name: string;
    language: string;
    category: CreateActionBody['category'];
    body: string;
    bodyExamples?: string[];
    footer?: string;
    headerFormat: CreateActionBody['headerFormat'];
    headerText?: string;
    headerExample?: string;
    headerMediaUrl?: string;
    buttons?: unknown[];
    allowCategoryChange?: boolean;
}

/** Body for `POST /create-flow`. */
export interface CreateFlowActionBody {
    projectId: string;
    flowId: string;
    templateName: string;
    language: string;
    category: CreateActionBody['category'];
    bodyText: string;
    buttonText: string;
}

/** Body for `POST /edit`. */
export interface EditActionBody {
    projectId: string;
    metaTemplateId: string;
    category?: CreateActionBody['category'];
    headerFormat?: CreateActionBody['headerFormat'];
    headerText?: string;
    headerMediaUrl?: string;
    body?: string;
    bodyExamples?: string[];
    footer?: string;
    buttons?: unknown[];
}

/** Body for `POST /library/save` — mirrors the engine DTO. */
export interface LibrarySaveBody {
    name: string;
    category: CreateActionBody['category'];
    language: string;
    body: string;
    /** Opaque Meta-shaped components array. */
    components: unknown;
}

/** Body for `POST /delete-by-name`. */
export interface DeleteByNameBody {
    projectId: string;
    templateName: string;
    metaTemplateId?: string;
}

/** Body for `POST /delete-by-id`. */
export interface DeleteByIdBody {
    projectId: string;
    metaTemplateId: string;
}

/** Body for `POST /library/{id}/apply`. */
export interface ApplyBody {
    targetProjectIds: string[];
}

// ---------------------------------------------------------------------------
// Query helper
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatTemplatesActionsApi = {
    list: (projectId: string) =>
        rustFetch<RustTemplate[]>(`${BASE}/list${qs({ project_id: projectId })}`),

    sync: (body: SyncBody) =>
        rustFetch<SyncActionResult>(`${BASE}/sync`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    create: (body: CreateActionBody) =>
        rustFetch<ActionState>(`${BASE}/create`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    bulkCreate: (body: BulkCreateActionBody) =>
        rustFetch<BulkCreateActionResult>(`${BASE}/bulk-create`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    createFlow: (body: CreateFlowActionBody) =>
        rustFetch<CreateFlowActionResult>(`${BASE}/create-flow`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    edit: (body: EditActionBody) =>
        rustFetch<ActionState>(`${BASE}/edit`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteByName: (body: DeleteByNameBody) =>
        rustFetch<ActionState>(`${BASE}/delete-by-name`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteById: (body: DeleteByIdBody) =>
        rustFetch<ActionState>(`${BASE}/delete-by-id`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    libraryList: () => rustFetch<RustLibraryTemplate[]>(`${BASE}/library/list`),

    librarySave: (body: LibrarySaveBody) =>
        rustFetch<ActionState>(`${BASE}/library/save`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    libraryDelete: (id: string) =>
        rustFetch<ActionState>(
            `${BASE}/library/${encodeURIComponent(id)}/delete`,
            { method: 'POST' },
        ),

    libraryApply: (sourceTemplateId: string, body: ApplyBody) =>
        rustFetch<ApplyActionResult>(
            `${BASE}/library/${encodeURIComponent(sourceTemplateId)}/apply`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatTemplatesActionsApi = typeof wachatTemplatesActionsApi;
