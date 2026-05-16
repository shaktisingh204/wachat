'use server';

/**
 * CRM Custom Fields server actions.
 *
 * Thin shims over the Rust BFF (`crmCustomFieldsApi`). No direct Mongo
 * access — no legacy fallback. The dashboard page calls these with
 * FormData (`saveCustomField`) or via the typed helpers
 * (`getCustomFields`, `getCustomFieldById`, `deleteCustomField`).
 *
 * Form contract for `saveCustomField`:
 *   - `fieldId?`          → presence triggers a PATCH instead of POST
 *   - entityKind, name, label, fieldType                 (required)
 *   - helpText, placeholder, section                     (optional)
 *   - required, unique, isActive,
 *     visibleInList, visibleInForm, editableInForm       (checkboxes: 'on' | absent)
 *   - displayOrder                                        (integer string)
 *   - optionsJson                                         (hidden JSON, only for select/multiselect)
 *   - validation.min / validation.max / validation.pattern (only for number/text)
 *
 * All writes revalidate `/dashboard/crm/settings/custom-fields`.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  crmCustomFieldsApi,
  type CrmCustomFieldCreateInput,
  type CrmCustomFieldDoc,
  type CrmCustomFieldOption,
  type CrmCustomFieldType,
  type CrmCustomFieldUpdateInput,
  type CrmCustomFieldValidation,
} from '@/lib/rust-client/crm-custom-fields';

const LIST_PATH = '/dashboard/crm/settings/custom-fields';

const FIELD_TYPES: ReadonlySet<CrmCustomFieldType> = new Set([
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'select',
  'multiselect',
  'url',
  'email',
  'phone',
  'file',
]);

const OPTION_BEARING_TYPES: ReadonlySet<CrmCustomFieldType> = new Set([
  'select',
  'multiselect',
]);

const VALIDATABLE_TYPES: ReadonlySet<CrmCustomFieldType> = new Set([
  'text',
  'textarea',
  'number',
  'currency',
]);

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (typeof v !== 'string') return false;
  return v === 'true' || v === 'on' || v === '1';
}

function pickInt(formData: FormData, key: string): number | undefined {
  const v = pickString(formData, key);
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function pickFieldType(formData: FormData): CrmCustomFieldType | undefined {
  const v = pickString(formData, 'fieldType');
  if (!v) return undefined;
  return FIELD_TYPES.has(v as CrmCustomFieldType)
    ? (v as CrmCustomFieldType)
    : undefined;
}

/**
 * Parse the hidden `optionsJson` field into a structured option array.
 * Empty / invalid JSON returns `undefined` so the caller can omit the
 * property from the payload instead of writing `[]`.
 */
function pickOptions(formData: FormData): CrmCustomFieldOption[] | undefined {
  const raw = pickString(formData, 'optionsJson');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const cleaned = parsed
      .filter((o: unknown): o is Record<string, unknown> =>
        typeof o === 'object' && o !== null,
      )
      .map((o) => {
        const label = typeof o.label === 'string' ? o.label.trim() : '';
        const value = typeof o.value === 'string' ? o.value.trim() : '';
        const color = typeof o.color === 'string' ? o.color.trim() : '';
        const opt: CrmCustomFieldOption = {
          label,
          value: value || label,
        };
        if (color) opt.color = color;
        return opt;
      })
      .filter((o) => o.label.length > 0 && o.value.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  } catch {
    return undefined;
  }
}

function pickValidation(
  formData: FormData,
  fieldType: CrmCustomFieldType,
): CrmCustomFieldValidation | undefined {
  if (!VALIDATABLE_TYPES.has(fieldType)) return undefined;
  const min = pickString(formData, 'validation.min');
  const max = pickString(formData, 'validation.max');
  const pattern = pickString(formData, 'validation.pattern');
  const out: CrmCustomFieldValidation = {};
  if (min !== undefined) {
    const n = Number.parseFloat(min);
    if (Number.isFinite(n)) out.min = n;
  }
  if (max !== undefined) {
    const n = Number.parseFloat(max);
    if (Number.isFinite(n)) out.max = n;
  }
  if (pattern !== undefined) out.pattern = pattern;
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ─── Read ────────────────────────────────────────────────────── */

/**
 * List custom fields, optionally filtered by entity kind. Returns rows
 * sorted by `display_order` ASC so the settings page can render them in
 * the order the user expects. Errors are swallowed (and counted) so the
 * page can render an empty state instead of crashing.
 */
export async function getCustomFields(
  entityKind?: string,
): Promise<CrmCustomFieldDoc[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const res = await crmCustomFieldsApi.list({
      entityKind: entityKind && entityKind !== 'all' ? entityKind : undefined,
      limit: 200,
    });
    const items = Array.isArray(res?.items) ? res.items : [];
    return [...items].sort(
      (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    );
  } catch (e) {
    console.error('[getCustomFields] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_custom_field',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return [];
  }
}

export async function getCustomFieldById(
  id: string,
): Promise<CrmCustomFieldDoc | null> {
  if (!id) return null;
  const session = await getSession();
  if (!session?.user) return null;

  try {
    return await crmCustomFieldsApi.getById(id);
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return null;
    console.error('[getCustomFieldById] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_custom_field',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return null;
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

/**
 * Create or update a custom field from a `<form action={...}>` post.
 *
 * The presence of `fieldId` in the FormData switches between PATCH and
 * POST. All boolean flags are read as checkbox-style (`'on'` ↔ true).
 * Options and validation are only included when the field type makes
 * them meaningful.
 */
export async function saveCustomField(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, 'fieldId');
  const guard = await requirePermission(
    'crm_custom_field',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const entityKind = pickString(formData, 'entityKind');
  const name = pickString(formData, 'name');
  const label = pickString(formData, 'label');
  const fieldType = pickFieldType(formData);

  if (!entityKind) return { error: 'Entity kind is required.' };
  if (!name) return { error: 'Internal name is required.' };
  if (!label) return { error: 'Display label is required.' };
  if (!fieldType) return { error: 'A valid field type is required.' };

  // Internal name must be a slug — enforce here so the Rust side never
  // sees `My Field` / `email-address` and ends up with two competing
  // representations.
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return {
      error:
        'Internal name must start with a lowercase letter and contain only lowercase letters, digits, and underscores.',
    };
  }

  const helpText = pickString(formData, 'helpText');
  const placeholder = pickString(formData, 'placeholder');
  const section = pickString(formData, 'section');
  const displayOrder = pickInt(formData, 'displayOrder') ?? 0;
  const required = pickBool(formData, 'required');
  const unique = pickBool(formData, 'unique');
  const isActive = pickBool(formData, 'isActive');
  const visibleInList = pickBool(formData, 'visibleInList');
  const visibleInForm = pickBool(formData, 'visibleInForm');
  const editableInForm = pickBool(formData, 'editableInForm');

  const options = OPTION_BEARING_TYPES.has(fieldType)
    ? pickOptions(formData)
    : undefined;

  if (OPTION_BEARING_TYPES.has(fieldType) && (!options || options.length === 0)) {
    return {
      error: 'Select / multiselect fields require at least one option.',
    };
  }

  const validation = pickValidation(formData, fieldType);

  try {
    let result: CrmCustomFieldDoc;
    if (id) {
      const patch: CrmCustomFieldUpdateInput = {
        entityKind,
        name,
        label,
        fieldType,
        helpText,
        placeholder,
        section,
        required,
        unique,
        isActive,
        visibleInList,
        visibleInForm,
        editableInForm,
        displayOrder,
        options,
        validation,
      };
      result = await crmCustomFieldsApi.update(id, patch);
    } else {
      const draft: CrmCustomFieldCreateInput = {
        entityKind,
        name,
        label,
        fieldType,
        helpText,
        placeholder,
        section,
        required,
        unique,
        isActive,
        visibleInList,
        visibleInForm,
        editableInForm,
        displayOrder,
        options,
        validation,
      };
      const created = await crmCustomFieldsApi.create(draft);
      result = created.entity;
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'crm_custom_field',
        entityId: String(result._id),
        reason: `${entityKind}.${name}`,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    return {
      message: id ? 'Custom field updated.' : 'Custom field created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveCustomField] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_custom_field',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a custom field. The handler does NOT scrub stored values
 * on existing records — that's a deliberate choice so historic data is
 * not lost when a field is retired.
 */
export async function deleteCustomField(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing custom-field id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_custom_field', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmCustomFieldsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'crm_custom_field',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Custom field not found.' };
    }
    console.error('[deleteCustomField] rust path failed:', e);
    recordRustFallback({
      entity: 'crm_custom_field',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
