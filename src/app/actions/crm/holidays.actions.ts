'use server';

/**
 * CRM Holiday server actions.
 *
 * Thin shims over the Rust BFF (`crmHolidaysApi`). No direct Mongo
 * access. FormData callers (the create/edit pages) hit
 * `saveHolidayAction` / `deleteHolidayAction`; programmatic callers
 * can use the typed helpers (`listHolidays`, `getHoliday`).
 *
 * 'holiday' is NOT in WsCustomFieldBelongsTo — custom-fields are
 * deliberately skipped for this entity.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmHolidaysApi,
  type CrmHolidayCreateInput,
  type CrmHolidayDoc,
  type CrmHolidayListParams,
  type CrmHolidayType,
  type CrmHolidayUpdateInput,
} from '@/lib/rust-client/crm-holidays';

const LIST_PATH = '/dashboard/crm/hr-payroll/holidays';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

const HOLIDAY_TYPES: ReadonlySet<CrmHolidayType> = new Set([
  'national',
  'regional',
  'religious',
  'optional',
  'restricted',
]);

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

interface HolidayListResult {
  holidays: CrmHolidayDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listHolidays(
  params: CrmHolidayListParams = {},
): Promise<HolidayListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const holidays = await crmHolidaysApi.list({ ...params, page, limit });
    return { holidays, page, limit, hasMore: holidays.length === limit };
  } catch (e) {
    recordRustFallback({ entity: 'holiday', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { holidays: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getHoliday(
  id: string,
): Promise<{ holiday: CrmHolidayDoc | null; error?: string }> {
  if (!id) return { holiday: null, error: 'Missing holiday id.' };
  try {
    const holiday = await crmHolidaysApi.getById(id);
    return { holiday };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { holiday: null, error: 'Holiday not found.' };
    }
    recordRustFallback({ entity: 'holiday', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { holiday: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

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

function pickHolidayType(formData: FormData): CrmHolidayType | undefined {
  const v = pickString(formData, 'holidayType');
  if (!v) return undefined;
  return HOLIDAY_TYPES.has(v as CrmHolidayType)
    ? (v as CrmHolidayType)
    : undefined;
}

/**
 * Build the `applicableLocations` list from the form. The form posts
 * country + state ids individually — we merge them into a single list
 * to match the Rust DTO's `applicable_locations: Vec<String>`.
 */
function pickLocations(formData: FormData): string[] | undefined {
  const country = pickString(formData, 'countryId');
  const state = pickString(formData, 'stateId');
  const locs = [country, state].filter((v): v is string => !!v);
  return locs.length > 0 ? locs : undefined;
}

/**
 * Convert a `<input type="date">` value (`YYYY-MM-DD`) into an ISO-8601
 * datetime at UTC midnight — the Rust DTO expects a full datetime.
 */
function dateInputToIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00Z`;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Holidays do not have a `customFields` panel.
 */
export async function saveHolidayAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission(
    'crm_holiday',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  // Keep the flag referenced so the dual-impl helper survives lint.
  void useRustCrm();

  const name = pickString(formData, 'name');
  const date = dateInputToIso(pickString(formData, 'date'));

  if (!name) return { error: 'Holiday name is required.' };
  if (!date) return { error: 'Holiday date is required.' };

  const holidayType = pickHolidayType(formData);
  const recurring = pickBool(formData, 'recurring');
  const applicableLocations = pickLocations(formData);
  const notes = pickString(formData, 'notes');

  try {
    let result: CrmHolidayDoc;
    if (id) {
      const patch: CrmHolidayUpdateInput = {
        date,
        name,
        holidayType,
        recurring,
        applicableLocations,
        notes,
      };
      result = await crmHolidaysApi.update(id, patch);
    } else {
      const draft: CrmHolidayCreateInput = {
        date,
        name,
        holidayType,
        recurring,
        applicableLocations,
        notes,
      };
      result = await crmHolidaysApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'holiday',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Holiday updated.' : 'Holiday created.',
      id: String(result._id),
    };
  } catch (e) {
    recordRustFallback({ entity: 'holiday', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a holiday. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteHolidayAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing holiday id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission('crm_holiday', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    await crmHolidaysApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'holiday',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Holiday not found.' };
    }
    recordRustFallback({ entity: 'holiday', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmHolidaysApi.x(...)`.

export async function createHoliday(input: CrmHolidayCreateInput) {
  return crmHolidaysApi.create(input);
}

export async function updateHoliday(
  id: string,
  patch: CrmHolidayUpdateInput,
) {
  return crmHolidaysApi.update(id, patch);
}

export async function deleteHoliday(id: string) {
  return crmHolidaysApi.delete(id);
}
