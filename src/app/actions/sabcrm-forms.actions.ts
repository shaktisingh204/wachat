'use server';

/**
 * SabCRM Forms — gated server actions.
 *
 * Thin wrappers over the project-scoped re-mounts of the legacy web-to-lead
 * form engine ({@link sabcrmFormsApi} in `@/lib/rust-client/sabcrm-forms`,
 * bases `/v1/sabcrm/forms` + `/v1/sabcrm/form-submissions`). Same crates,
 * same `crm_forms` / `crm_form_submissions` collections — tenant-scoped by
 * `projectId` instead of `userId`.
 *
 * Every action follows the SAME pipeline as `sabcrm-finance.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * `convertSabcrmSubmissionToRecord` is the bridge to the suite's generic
 * record store: it maps submission `data` through the form's per-field
 * `mapping` keys and creates a record on the form's `targetObject`
 * (default `leads`) via {@link sabcrmRecordsApi} — the same client
 * `sabcrm-twenty.actions.ts` uses — then marks the submission `processed`.
 *
 * The PUBLIC render/submit flow does NOT live here — see
 * `sabcrm-forms-public.actions.ts` (unauthenticated by design).
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmFormsApi } from '@/lib/rust-client/sabcrm-forms';
import type {
  SabcrmFormDoc,
  SabcrmFormField,
  SabcrmFormListParams,
  SabcrmFormSubmissionDoc,
  SabcrmFormSubmissionListParams,
} from '@/lib/rust-client/sabcrm-forms';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmRoutingApi } from '@/lib/rust-client/sabcrm-routing';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmFormBuilderInput,
  SabcrmFormConvertResult,
} from './sabcrm-forms.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Path revalidated after mutations so the Forms UI re-fetches. */
const FORMS_PATH = '/sabcrm/forms';

/** Hard cap on rows pulled for a CSV export (25 pages × 200). */
const CSV_MAX_ROWS = 5000;
const CSV_PAGE_SIZE = 200;

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-finance.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Builder payload → Rust wire shape
// ---------------------------------------------------------------------------

/** A field key must be a stable, non-empty identifier-ish token. */
function normalizeFieldKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface BuilderWire {
  name: string;
  fields: SabcrmFormField[];
  settings: NonNullable<SabcrmFormDoc['settings']>;
  status: string;
}

/** Validate + translate the builder payload into the Rust wire shape. */
function builderToWire(
  input: SabcrmFormBuilderInput,
): { ok: true; wire: BuilderWire } | { ok: false; error: string } {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'A form name is required.' };

  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    return { ok: false, error: 'Add at least one field.' };
  }

  const seen = new Set<string>();
  const fields: SabcrmFormField[] = [];
  for (const f of input.fields) {
    const key = normalizeFieldKey(f.key || f.label || '');
    if (!key) return { ok: false, error: 'Every field needs a key.' };
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate field key "${key}".` };
    }
    seen.add(key);
    const type = ['text', 'email', 'phone', 'textarea', 'select'].includes(
      f.type,
    )
      ? f.type
      : 'text';
    const options =
      type === 'select'
        ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
        : undefined;
    if (type === 'select' && (!options || options.length === 0)) {
      return {
        ok: false,
        error: `Select field "${f.label || key}" needs at least one option.`,
      };
    }
    fields.push({
      name: key,
      label: f.label?.trim() || key,
      type,
      required: !!f.required,
      placeholder: f.placeholder?.trim() || undefined,
      options,
      mapping: f.mapping?.trim() || undefined,
    });
  }

  const webhookUrl = input.webhookUrl?.trim() || '';
  const settings: BuilderWire['settings'] = {
    description: input.description?.trim() || undefined,
    targetObject: input.targetObject?.trim() || 'leads',
    postSubmit: {
      successMessage: input.successMessage?.trim() || undefined,
      redirectUrl: input.redirectUrl?.trim() || undefined,
      webhook: webhookUrl
        ? {
            enabled: true,
            url: webhookUrl,
            secret: input.webhookSecret?.trim() || undefined,
          }
        : undefined,
    },
  };

  const status = ['draft', 'published', 'archived'].includes(
    input.status ?? '',
  )
    ? (input.status as string)
    : 'published';

  return { ok: true, wire: { name, fields, settings, status } };
}

// ---------------------------------------------------------------------------
// Forms CRUD
// ---------------------------------------------------------------------------

/** Lists the project's forms through the Rust engine (archived hidden). */
export async function listSabcrmForms(
  params?: SabcrmFormListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmFormDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFormsApi.listForms(g.ctx.projectId, {
      limit: 200,
      ...params,
    });
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list forms.');
  }
}

/** Fetches a single form (404 ⇒ `{ ok: false }`). */
export async function getSabcrmForm(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmFormDoc>> {
  if (!id) return { ok: false, error: 'Form id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFormsApi.getForm(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load form.');
  }
}

/**
 * Creates (no `input.id`) or updates (`input.id` set) a form from the
 * minimal-builder payload.
 */
export async function saveSabcrmForm(
  input: SabcrmFormBuilderInput,
  projectId?: string,
): Promise<ActionResult<SabcrmFormDoc>> {
  const wire = builderToWire(input);
  if (!wire.ok) return { ok: false, error: wire.error };

  const g = await gate(input.id ? 'edit' : 'create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    let doc: SabcrmFormDoc;
    if (input.id) {
      doc = await sabcrmFormsApi.updateForm(g.ctx.projectId, input.id, {
        name: wire.wire.name,
        fields: wire.wire.fields,
        settings: wire.wire.settings,
        status: wire.wire.status,
      });
    } else {
      const created = await sabcrmFormsApi.createForm(g.ctx.projectId, {
        name: wire.wire.name,
        fields: wire.wire.fields,
        settings: wire.wire.settings,
        status: wire.wire.status,
      });
      doc = created.entity;
    }
    revalidatePath(FORMS_PATH);
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to save form.');
  }
}

/** Archives a form (soft delete on the Rust side). */
export async function deleteSabcrmForm(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!id) return { ok: false, error: 'Form id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFormsApi.deleteForm(g.ctx.projectId, id);
    revalidatePath(FORMS_PATH);
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Failed to delete form.');
  }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

/** Lists a form's submissions (newest first, archived hidden). */
export async function listSabcrmFormSubmissions(
  formId: string,
  params?: Omit<SabcrmFormSubmissionListParams, 'formId'>,
  projectId?: string,
): Promise<ActionResult<SabcrmFormSubmissionDoc[]>> {
  if (!formId) return { ok: false, error: 'Form id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFormsApi.listSubmissions(g.ctx.projectId, {
      formId,
      limit: 200,
      ...params,
    });
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list submissions.');
  }
}

/** RFC 4180-ish CSV escaping (quote when needed, double inner quotes). */
function csvCell(raw: unknown): string {
  let s: string;
  if (raw == null) s = '';
  else if (typeof raw === 'object') s = JSON.stringify(raw);
  else s = String(raw);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Exports ALL of a form's submissions as a CSV string (capped at
 * {@link CSV_MAX_ROWS}). Columns: submission metadata, then the form's
 * fields in their defined order (header = field label), then any extra
 * `data` keys seen in submissions but absent from the field list.
 */
export async function exportSabcrmFormSubmissionsCsv(
  formId: string,
  projectId?: string,
): Promise<ActionResult<string>> {
  if (!formId) return { ok: false, error: 'Form id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const form = await sabcrmFormsApi.getForm(g.ctx.projectId, formId);

    // Pull every page (newest first) up to the cap.
    const rows: SabcrmFormSubmissionDoc[] = [];
    let page = 1;
    for (;;) {
      const res = await sabcrmFormsApi.listSubmissions(g.ctx.projectId, {
        formId,
        page,
        limit: CSV_PAGE_SIZE,
        status: 'all',
      });
      rows.push(...res.items);
      if (!res.hasMore || rows.length >= CSV_MAX_ROWS) break;
      page += 1;
    }
    if (rows.length > CSV_MAX_ROWS) rows.length = CSV_MAX_ROWS;

    // Column plan: form fields first (stable order), then stray data keys.
    const fieldKeys = form.fields.map((f) => f.name);
    const known = new Set(fieldKeys);
    const extras: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row.data ?? {})) {
        if (!known.has(key)) {
          known.add(key);
          extras.push(key);
        }
      }
    }

    const header = [
      'Submitted at',
      'Status',
      ...form.fields.map((f) => f.label || f.name),
      ...extras,
      'Source URL',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) {
      const data = row.data ?? {};
      lines.push(
        [
          row.createdAt,
          row.status,
          ...fieldKeys.map((k) => data[k]),
          ...extras.map((k) => data[k]),
          row.sourceUrl ?? '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return { ok: true, data: lines.join('\r\n') };
  } catch (e) {
    return fail(e, 'Failed to export submissions.');
  }
}

/**
 * Converts a submission into a SabCRM record on the form's target object
 * (default `leads`) via the generic records engine, then marks the
 * submission `processed`.
 *
 * Mapping design: for each form field, the submitted value under the
 * field's `name` is written to the record `data` key chosen by the field's
 * `mapping` (falling back to the field `name` itself). Submission keys not
 * defined on the form are ignored. When no mapped key produced a `name`,
 * the first non-empty mapped string is duplicated into `data.name` so the
 * record has a usable label in list views.
 */
export async function convertSabcrmSubmissionToRecord(
  submissionId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmFormConvertResult>> {
  if (!submissionId) return { ok: false, error: 'Submission id is required.' };

  // Creating a record is a `create`; the follow-up status flip is implied.
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const submission = await sabcrmFormsApi.getSubmission(
      g.ctx.projectId,
      submissionId,
    );
    const form = await sabcrmFormsApi.getForm(
      g.ctx.projectId,
      submission.formId,
    );

    const object = form.settings?.targetObject?.trim() || 'leads';
    const data: Record<string, unknown> = {};
    const submitted = submission.data ?? {};
    for (const field of form.fields) {
      const raw = submitted[field.name];
      if (raw === undefined || raw === null || raw === '') continue;
      const key = field.mapping?.trim() || field.name;
      data[key] = raw;
    }
    if (Object.keys(data).length === 0) {
      return { ok: false, error: 'This submission has no data to convert.' };
    }
    // Ensure the record has a label-ish `name` for list views.
    if (data.name === undefined) {
      const firstString = Object.values(data).find(
        (v): v is string => typeof v === 'string' && v.trim() !== '',
      );
      if (firstString) data.name = firstString;
    }

    const record = await sabcrmRecordsApi.create(object, {
      projectId: g.ctx.projectId,
      data,
      createdBy: g.ctx.userId,
    });

    // Best effort: run the `form.submission` assignment-routing rules
    // (crate `sabcrm-routing`) so the converted record lands with an owner.
    // Additive — a downed engine or no matching rule never fails the
    // conversion (the record already exists).
    try {
      await sabcrmRoutingApi.evaluate(g.ctx.projectId, {
        objectSlug: object,
        recordId: record.id,
        trigger: 'form.submission',
      });
    } catch {
      // Non-fatal — the record stays unassigned.
    }

    // Best effort: mark processed; conversion already succeeded.
    try {
      await sabcrmFormsApi.updateSubmission(g.ctx.projectId, submissionId, {
        status: 'processed',
        processedAt: new Date().toISOString(),
        notes: `Converted to ${object} record ${record.id}`,
      });
    } catch {
      // Non-fatal — the record exists; the row just stays "new".
    }

    revalidatePath(FORMS_PATH);
    revalidatePath(`${FORMS_PATH}/${submission.formId}/submissions`);
    return { ok: true, data: { object, recordId: record.id } };
  } catch (e) {
    return fail(e, 'Failed to convert the submission.');
  }
}
