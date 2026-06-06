/**
 * Client for the Wachat **contacts** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/contacts` by the
 * `wachat-contacts` crate. Each method is a one-line shim around
 * {@link rustFetch} so the namespace surface stays close to the OpenAPI
 * operation IDs — when codegen replaces this file the call sites won't
 * change.
 *
 *   POST   /                          → add
 *   GET    /?projectId=&...           → list
 *   POST   /import                    → importContacts
 *   PATCH  /{id}                      → updateDetails
 *   PATCH  /{id}/status               → updateStatus
 *   PATCH  /{id}/tags                 → updateTags
 *   DELETE /{id}                      → delete
 *   GET    /kanban?projectId=&...     → getKanban
 *   POST   /kanban/statuses           → saveKanbanStatuses
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/contacts';

// ---------------------------------------------------------------------------
// Wire shapes (mirror the Rust DTOs — camelCase over the wire because every
// Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/** Body for `POST /v1/contacts`. */
export interface AddContactBody {
    projectId: string;
    phoneNumberId: string;
    name: string;
    /** E.164 country code (digits and `+` allowed; Rust strips non-digits). */
    countryCode: string;
    /** Local subscriber number. */
    phone: string;
    /** Optional list of hex `ObjectId` strings for tag attachment. */
    tagIds?: string[];
}

/** Response for `POST /v1/contacts`. */
export interface AddContactResponse {
    message: string;
    contactId: string;
}

/** Query for `GET /v1/contacts`. */
export interface ListContactsQuery {
    projectId: string;
    phoneNumberId?: string;
    page?: number;
    search?: string;
    /** Hex `ObjectId` strings — flattened to a comma-delimited string on the wire. */
    tagIds?: string[];
}

/** Response for `GET /v1/contacts`. */
export interface ListContactsResponse {
    contacts: any[];
    total: number;
}

/** Body for `POST /v1/contacts/import`. */
export interface ImportContactsBody {
    projectId: string;
    phoneNumberId: string;
    /**
     * Pre-parsed CSV / XLSX rows. `phone` and `name` are the canonical
     * fields; every other key flows into `variables` on the upserted
     * contact.
     */
    contacts: Array<{ phone: string; name: string; [key: string]: unknown }>;
}

/** Response for `POST /v1/contacts/import`. */
export interface ImportContactsResponse {
    message: string;
    imported: number;
    skipped: number;
}

/** Body for `PATCH /v1/contacts/{id}`. */
export interface UpdateContactDetailsBody {
    name?: string;
    variables?: Record<string, unknown> | null;
}

/** Body for `PATCH /v1/contacts/{id}/status`. */
export interface UpdateContactStatusBody {
    status: string;
    /** Hex `ObjectId` string — omit / null clears the assignment. */
    assignedAgentId?: string | null;
}

/** Body for `PATCH /v1/contacts/{id}/tags`. */
export interface UpdateContactTagsBody {
    /** Hex `ObjectId` strings. */
    tagIds: string[];
}

/** Generic `{ success: true }` envelope. */
export interface SuccessResponse {
    success: boolean;
}

/**
 * One kanban column from `GET /v1/contacts/kanban`.
 *
 * Mirrors the Rust `KanbanColumn` DTO: `id` is the stable status slug the
 * move handler (`PATCH /{id}/status`) persists, `title` is the human label
 * (currently identical to `id`), and `contacts` are the raw stored contact
 * documents (`_id` → hex, dates → ISO 8601) — the same `Contact` shape the
 * board already understands.
 */
export interface KanbanColumn {
    id: string;
    title: string;
    contacts: any[];
}

/**
 * Response for `GET /v1/contacts/kanban`. Column ordering mirrors the native
 * board: default statuses (`new`, `open`, `resolved`) first, then any custom
 * `kanbanStatuses` saved on the project, deduped.
 */
export interface KanbanResponse {
    columns: KanbanColumn[];
}

/** Query for `GET /v1/contacts/kanban`. */
export interface KanbanQuery {
    projectId: string;
    /** Optional phone-number scope; omit for "all numbers in the project". */
    phoneNumberId?: string;
}

/**
 * Body for `POST /v1/contacts/kanban/statuses`. The full list of column names
 * currently on the board (defaults + custom); the Rust handler strips the
 * default statuses before persisting only the user-added lists.
 */
export interface SaveKanbanStatusesBody {
    projectId: string;
    statuses: string[];
}

// ---------------------------------------------------------------------------
// Query helpers — keep `?projectId=…&...` strings off the call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatContactsApi = {
    /** `POST /v1/contacts` — handleAddNewContact. */
    add: (body: AddContactBody) =>
        rustFetch<AddContactResponse>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `GET /v1/contacts?...` — getContactsPageData. */
    list: (q: ListContactsQuery) =>
        rustFetch<ListContactsResponse>(
            `${BASE}/${qs({
                projectId: q.projectId,
                phoneNumberId: q.phoneNumberId,
                page: q.page,
                search: q.search,
                // Comma-delimited per the Rust handler's contract.
                tagIds: q.tagIds && q.tagIds.length > 0 ? q.tagIds.join(',') : undefined,
            })}`,
        ),

    /** `POST /v1/contacts/import` — handleImportContacts. */
    importContacts: (body: ImportContactsBody) =>
        rustFetch<ImportContactsResponse>(`${BASE}/import`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `PATCH /v1/contacts/{id}` — handleUpdateContactDetails. */
    updateDetails: (contactId: string, body: UpdateContactDetailsBody) =>
        rustFetch<SuccessResponse>(`${BASE}/${encodeURIComponent(contactId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    /** `PATCH /v1/contacts/{id}/status` — handleUpdateContactStatus. */
    updateStatus: (contactId: string, body: UpdateContactStatusBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/${encodeURIComponent(contactId)}/status`,
            {
                method: 'PATCH',
                body: JSON.stringify(body),
            },
        ),

    /** `PATCH /v1/contacts/{id}/tags` — updateContactTags. */
    updateTags: (contactId: string, body: UpdateContactTagsBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/${encodeURIComponent(contactId)}/tags`,
            {
                method: 'PATCH',
                body: JSON.stringify(body),
            },
        ),

    /** `DELETE /v1/contacts/{id}` — deleteContact. */
    delete: (contactId: string) =>
        rustFetch<SuccessResponse>(`${BASE}/${encodeURIComponent(contactId)}`, {
            method: 'DELETE',
        }),

    /** `GET /v1/contacts/kanban?...` — getKanbanData (contacts-domain board). */
    getKanban: (projectId: string, phoneNumberId?: string) =>
        rustFetch<KanbanResponse>(
            `${BASE}/kanban${qs({ projectId, phoneNumberId })}`,
        ),

    /** `POST /v1/contacts/kanban/statuses` — saveKanbanStatuses. */
    saveKanbanStatuses: (projectId: string, statuses: string[]) =>
        rustFetch<SuccessResponse>(`${BASE}/kanban/statuses`, {
            method: 'POST',
            body: JSON.stringify({ projectId, statuses } satisfies SaveKanbanStatusesBody),
        }),
};

export type WachatContactsApi = typeof wachatContactsApi;
