/**
 * Client for the Wachat templates router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/templates` by the
 * `wachat-templates` crate. Each method is a one-line shim around
 * {@link rustFetch} so the surface stays close to the OpenAPI operation IDs —
 * when codegen replaces this file the call sites won't change.
 *
 *   GET    /                       → list (query: project_id)
 *   GET    /:id                    → getById (query: project_id)
 *   POST   /                       → create
 *   POST   /bulk                   → bulkCreate
 *   POST   /flow                   → createFlow
 *   POST   /sync                   → sync { project_id }
 *   POST   /:id/edit               → edit
 *   DELETE /:id                    → deleteById
 *   DELETE /by-name                → deleteByName (query: project_id, name)
 *   POST   /:id/send               → send
 *   GET    /library                → listLibrary
 *   POST   /library                → saveLibrary
 *   DELETE /library/:id            → deleteLibrary
 *   POST   /library/:id/apply      → applyLibrary
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/templates';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror `wachat_types::template::*` on the Rust side, camelCase
// over the wire because the Rust handlers `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * Mirror of `wachat_types::template::Template`.
 *
 * `components` is intentionally `unknown[]` — the Meta WhatsApp template
 * component schema is a tagged union with many variants (HEADER, BODY,
 * BUTTONS, CAROUSEL, CATALOG_MESSAGE_ACTION, …). Modeling each variant here
 * would duplicate the existing `definitions.ts::Template` shape; leave the
 * narrowing to the call sites that already deal with `Template['components']`.
 */
export interface RustTemplate {
    id: string;
    projectId: string;
    name: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | 'INTERACTIVE';
    body: string;
    language: string;
    status: string;
    components: unknown[];
    metaId: string;
    headerSampleUrl?: string | null;
    qualityScore?: string | null;
    type?: 'STANDARD' | 'CATALOG_MESSAGE' | 'MARKETING_CAROUSEL' | 'LIMITED_TIME_OFFER' | null;
    headerMediaDataUri?: string | null;
    createdAt?: string | null;
}

/** Mirror of `wachat_types::template::LibraryTemplate`. */
export interface RustLibraryTemplate {
    id?: string | null;
    name: string;
    category: RustTemplate['category'];
    body: string;
    language: string;
    components: unknown[];
    type?: RustTemplate['type'];
    headerSampleUrl?: string | null;
    headerMediaDataUri?: string | null;
    isCustom?: boolean | null;
    createdAt?: string | null;
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/templates` — single create.
 *
 * The TS Server Action accepts a multipart `FormData`; the Rust handler takes
 * a fully-resolved JSON payload. The orchestrator (slice 8) is responsible
 * for uploading any header media to Meta first and forwarding the resulting
 * sample URL / media handle through this struct.
 */
export interface CreateTemplateBody {
    projectId: string;
    name: string;
    category: RustTemplate['category'];
    language: string;
    templateType: 'STANDARD' | 'MARKETING_CAROUSEL' | 'CATALOG_MESSAGE';
    body?: string;
    footer?: string;
    headerFormat?: 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'LOCATION';
    headerText?: string;
    headerExample?: string;
    headerSampleUrl?: string;
    headerSampleHandle?: string;
    bodyExamples?: Record<string, string>;
    buttons?: unknown[];
    carouselCards?: unknown[];
    // CATALOG_MESSAGE-only fields
    catalogId?: string;
    carouselHeader?: string;
    carouselBody?: string;
    carouselFooter?: string;
    sections?: Array<{ title: string; productIds: string[] }>;
}

/** Body for `POST /v1/wachat/templates/bulk`. */
export interface BulkCreateBody {
    projectIds: string[];
    name: string;
    category: RustTemplate['category'];
    language: string;
    body: string;
    footer?: string;
    headerFormat?: CreateTemplateBody['headerFormat'];
    headerText?: string;
    headerMediaDataUri?: string;
    buttons?: unknown[];
}

/** Body for `POST /v1/wachat/templates/flow`. */
export interface CreateFlowTemplateBody {
    projectId: string;
    flowId: string;
    templateName: string;
    language: string;
    category: RustTemplate['category'];
    bodyText: string;
    buttonText: string;
}

/** Body for `POST /v1/wachat/templates/:id/edit`. */
export interface EditTemplateBody {
    projectId: string;
    metaTemplateId: string;
    category?: RustTemplate['category'];
    headerFormat?: CreateTemplateBody['headerFormat'];
    headerText?: string;
    headerSampleUrl?: string;
    headerSampleHandle?: string;
    body?: string;
    footer?: string;
    bodyExamples?: Record<string, string>;
    buttons?: unknown[];
}

/** Body for `POST /v1/wachat/templates/sync`. */
export interface SyncBody {
    projectId: string;
}

/**
 * Body for `POST /v1/wachat/templates/:id/send`.
 *
 * Variables are split into `positional` (Meta's `{{1}}`-style numbered slots,
 * indexed from 1 → `positional[0]` = `{{1}}`) and `named` (free-form keys for
 * header/button/location-specific values like `location_lat`,
 * `variable_button_0`, …). The Rust side normalizes these into the Meta
 * payload; callers should not pre-build the Meta `components` array.
 *
 * `mediaId` is the WhatsApp media handle returned by an earlier upload; the
 * orchestrator uploads any browser-supplied file to Meta first, then passes
 * the resulting id here. There is intentionally no `mediaFile` field — this
 * client never carries raw bytes.
 */
export interface SendTemplateBody {
    recipientPhone: string;
    variables: {
        positional?: string[];
        named?: Record<string, string>;
    };
    mediaId?: string;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Result of `POST /v1/wachat/templates/sync`. */
export interface SyncOutcome {
    message?: string;
    syncedCount: number;
}

/** Result of `POST /v1/wachat/templates/bulk`. */
export interface BulkCreateOutcome {
    successes: number;
    skipped: number;
    failed: number;
    errors?: string[];
}

/** Result of `POST /v1/wachat/templates/:id/send`. */
export interface SendOutcome {
    wamid: string;
    message: string;
}

/** Result of `POST /v1/wachat/templates/library/:id/apply`. */
export interface ApplyLibraryOutcome {
    applied: number;
    skipped: number;
}

// ---------------------------------------------------------------------------
// Query helper — keeps the `?project_id=…&name=…` strings off the call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined>): string {
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

export const templatesApi = {
    list: (projectId: string) =>
        rustFetch<RustTemplate[]>(`${BASE}${qs({ project_id: projectId })}`),

    getById: (id: string, projectId: string) =>
        rustFetch<RustTemplate>(
            `${BASE}/${encodeURIComponent(id)}${qs({ project_id: projectId })}`,
        ),

    create: (body: CreateTemplateBody) =>
        rustFetch<RustTemplate>(BASE, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    bulkCreate: (body: BulkCreateBody) =>
        rustFetch<BulkCreateOutcome>(`${BASE}/bulk`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    createFlow: (body: CreateFlowTemplateBody) =>
        rustFetch<RustTemplate>(`${BASE}/flow`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sync: (body: SyncBody) =>
        rustFetch<SyncOutcome>(`${BASE}/sync`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    edit: (id: string, body: EditTemplateBody) =>
        rustFetch<RustTemplate>(`${BASE}/${encodeURIComponent(id)}/edit`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteById: (id: string) =>
        rustFetch<{ ok: boolean }>(`${BASE}/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

    deleteByName: (projectId: string, name: string) =>
        rustFetch<{ ok: boolean; deleted: number }>(
            `${BASE}/by-name${qs({ project_id: projectId, name })}`,
            { method: 'DELETE' },
        ),

    send: (templateId: string, body: SendTemplateBody) =>
        rustFetch<SendOutcome>(`${BASE}/${encodeURIComponent(templateId)}/send`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    listLibrary: () =>
        rustFetch<RustLibraryTemplate[]>(`${BASE}/library`),

    saveLibrary: (body: RustLibraryTemplate) =>
        rustFetch<RustLibraryTemplate>(`${BASE}/library`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    deleteLibrary: (id: string) =>
        rustFetch<{ ok: boolean }>(`${BASE}/library/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        }),

    applyLibrary: (id: string, projectIds: string[]) =>
        rustFetch<ApplyLibraryOutcome>(
            `${BASE}/library/${encodeURIComponent(id)}/apply`,
            {
                method: 'POST',
                body: JSON.stringify({ projectIds }),
            },
        ),
};

export type TemplatesApi = typeof templatesApi;
