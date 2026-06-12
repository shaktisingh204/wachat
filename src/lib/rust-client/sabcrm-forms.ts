import 'server-only';

/**
 * SabCRM Forms client — wraps the Rust `/v1/sabcrm/forms` +
 * `/v1/sabcrm/form-submissions` surfaces (crates `crm-forms` /
 * `crm-form-submissions`, `project_router` mounts in `sabnode-api`).
 *
 * These are the project-scoped re-mounts of the legacy web-to-lead form
 * engine: same handlers, same `crm_forms` / `crm_form_submissions` Mongo
 * collections, but every authenticated request must carry the active
 * SabCRM `projectId` (query string for GET/PATCH/DELETE, body for POST) —
 * the Rust side rejects requests without it. Membership of the project is
 * validated by the gated server actions in
 * `src/app/actions/sabcrm-forms.actions.ts` BEFORE calling this client;
 * never call it with an unvalidated projectId.
 *
 * The two PUBLIC endpoints (`GET  /v1/sabcrm/forms/public/{id}`,
 * `POST /v1/sabcrm/form-submissions/public/{id}`) are unauthenticated on
 * the Rust side — the form document carries its tenant — and are wrapped
 * by {@link sabcrmPublicFormsApi} via `rustPublicFetch` for the public
 * render page (`/embed/sabcrm-form/[formId]`).
 *
 * Wire shapes (camelCase) mirror the `serde(rename_all = "camelCase")`
 * Rust DTOs in `rust/crates/crm-forms/src/{types,dto}.rs` and
 * `rust/crates/crm-form-submissions/src/{types,dto}.rs`.
 */
import { rustFetch, rustPublicFetch } from './fetcher';

/* ─── Wire types ──────────────────────────────────────────────── */

/** One field definition on a form (mirrors Rust `CrmFormField`). */
export interface SabcrmFormField {
  /** Stable field key — the submission `data` key. */
  name: string;
  label?: string;
  /** `"text" | "email" | "phone" | "textarea" | "select"` (open set). */
  type?: string;
  required?: boolean;
  placeholder?: string;
  /** Options for `select` fields. */
  options?: string[];
  /**
   * SabCRM record `data.*` key this field maps onto when a submission is
   * converted into a record (e.g. `name`, `amount`, `email`). Falls back
   * to the field's own `name` when absent.
   */
  mapping?: string;
}

/** Post-submit behaviour blob stored under `settings.postSubmit`. */
export interface SabcrmFormPostSubmit {
  successMessage?: string;
  redirectUrl?: string;
  webhook?: {
    enabled?: boolean;
    url?: string;
    secret?: string;
  };
}

/** Free-form `settings` blob (description, target object, post-submit). */
export interface SabcrmFormSettings {
  description?: string;
  /** SabCRM object slug submissions convert into. Default `leads`. */
  targetObject?: string;
  /** Also create a linked `people` record on conversion when truthy. */
  createPerson?: boolean;
  postSubmit?: SabcrmFormPostSubmit;
  [key: string]: unknown;
}

/** A full form document as returned by the Rust engine. */
export interface SabcrmFormDoc {
  _id: string;
  userId?: string;
  projectId?: string;
  name: string;
  slug?: string;
  url?: string;
  fields: SabcrmFormField[];
  settings?: SabcrmFormSettings | null;
  submissionCount: number;
  /** `"draft" | "published" | "archived"`. */
  status: string;
  createdAt: string;
  updatedAt?: string;
}

/** Sanitised public form shape (`public_get_form` — no tenant ids). */
export interface SabcrmPublicFormDoc {
  id: string;
  name: string;
  slug?: string | null;
  fields: SabcrmFormField[];
  /** Webhook + notification settings are stripped server-side. */
  settings?: SabcrmFormSettings | null;
  status: string;
}

export type SabcrmFormSubmissionStatus = 'new' | 'processed' | 'spam' | 'archived';

/** A form submission document as returned by the Rust engine. */
export interface SabcrmFormSubmissionDoc {
  _id: string;
  userId?: string;
  projectId?: string;
  formId: string;
  data: Record<string, unknown>;
  sourceUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  status: SabcrmFormSubmissionStatus;
  processedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabcrmFormListParams {
  page?: number;
  limit?: number;
  q?: string;
  /** `all | draft | published | archived`; default hides archived. */
  status?: string;
}

export interface SabcrmFormListResponse {
  items: SabcrmFormDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcrmFormCreateInput {
  name: string;
  slug?: string;
  url?: string;
  fields?: SabcrmFormField[];
  settings?: SabcrmFormSettings;
  status?: string;
}

export type SabcrmFormUpdateInput = Partial<SabcrmFormCreateInput>;

export interface SabcrmFormSubmissionListParams {
  formId?: string;
  page?: number;
  limit?: number;
  q?: string;
  /** `all | new | processed | spam | archived`; default hides archived. */
  status?: string;
}

export interface SabcrmFormSubmissionListResponse {
  items: SabcrmFormSubmissionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcrmFormSubmissionUpdateInput {
  status?: SabcrmFormSubmissionStatus;
  processedAt?: string;
  notes?: string;
}

/** Public submit response (mirrors Rust `PublicSubmitResponse`). */
export interface SabcrmPublicSubmitResponse {
  success: boolean;
  message: string;
  redirectUrl?: string;
}

/* ─── Client ──────────────────────────────────────────────────── */

const FORMS_BASE = '/v1/sabcrm/forms';
const SUBMISSIONS_BASE = '/v1/sabcrm/form-submissions';

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmFormsApi = {
  /** `GET /v1/sabcrm/forms` — project-scoped paginated list. */
  listForms: (
    projectId: string,
    params?: SabcrmFormListParams,
  ): Promise<SabcrmFormListResponse> =>
    rustFetch<SabcrmFormListResponse>(
      `${FORMS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status,
      })}`,
    ),

  /** `GET /v1/sabcrm/forms/{id}` — single form (404 ⇒ throws). */
  getForm: (projectId: string, id: string): Promise<SabcrmFormDoc> =>
    rustFetch<SabcrmFormDoc>(
      `${FORMS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /** `POST /v1/sabcrm/forms` — create under the project scope. */
  createForm: (
    projectId: string,
    input: SabcrmFormCreateInput,
  ): Promise<{ id: string; entity: SabcrmFormDoc }> =>
    rustFetch<{ id: string; entity: SabcrmFormDoc }>(FORMS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),

  /** `PATCH /v1/sabcrm/forms/{id}` — partial update. */
  updateForm: (
    projectId: string,
    id: string,
    patch: SabcrmFormUpdateInput,
  ): Promise<SabcrmFormDoc> =>
    rustFetch<SabcrmFormDoc>(
      `${FORMS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /v1/sabcrm/forms/{id}` — archive (soft delete). */
  deleteForm: (
    projectId: string,
    id: string,
  ): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${FORMS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),

  /** `GET /v1/sabcrm/form-submissions` — project-scoped paginated list. */
  listSubmissions: (
    projectId: string,
    params?: SabcrmFormSubmissionListParams,
  ): Promise<SabcrmFormSubmissionListResponse> =>
    rustFetch<SabcrmFormSubmissionListResponse>(
      `${SUBMISSIONS_BASE}${qs({
        projectId,
        formId: params?.formId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status,
      })}`,
    ),

  /** `GET /v1/sabcrm/form-submissions/{id}` — single submission. */
  getSubmission: (
    projectId: string,
    id: string,
  ): Promise<SabcrmFormSubmissionDoc> =>
    rustFetch<SabcrmFormSubmissionDoc>(
      `${SUBMISSIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /** `PATCH /v1/sabcrm/form-submissions/{id}` — status / notes update. */
  updateSubmission: (
    projectId: string,
    id: string,
    patch: SabcrmFormSubmissionUpdateInput,
  ): Promise<SabcrmFormSubmissionDoc> =>
    rustFetch<SabcrmFormSubmissionDoc>(
      `${SUBMISSIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /v1/sabcrm/form-submissions/{id}` — archive (soft delete). */
  deleteSubmission: (
    projectId: string,
    id: string,
  ): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${SUBMISSIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/**
 * UNauthenticated wrappers for the public render/submit flow. Use ONLY
 * from the public form page / its server actions — the Rust side mounted
 * these without auth on purpose (the form document carries its tenant).
 */
export const sabcrmPublicFormsApi = {
  /** `GET /v1/sabcrm/forms/public/{publicId}` — sanitised form. */
  getPublicForm: (publicId: string): Promise<SabcrmPublicFormDoc> =>
    rustPublicFetch<SabcrmPublicFormDoc>(
      `${FORMS_BASE}/public/${encodeURIComponent(publicId)}`,
    ),

  /** `POST /v1/sabcrm/form-submissions/public/{publicId}` — submit. */
  submitPublicForm: (
    publicId: string,
    body: {
      data: Record<string, unknown>;
      sourceUrl?: string;
      userAgent?: string;
      referrer?: string;
    },
  ): Promise<SabcrmPublicSubmitResponse> =>
    rustPublicFetch<SabcrmPublicSubmitResponse>(
      `${SUBMISSIONS_BASE}/public/${encodeURIComponent(publicId)}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
