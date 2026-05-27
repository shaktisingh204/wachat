'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrSave,
  hrDelete,
  formToObject,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsInvoiceSetting,
  WsTaskSetting,
  WsProjectSetting,
  WsProjectStatusSetting,
  WsAttendanceSetting,
  WsExpenseCategoryRole,
  WsCurrencyFormatSetting,
} from '@/lib/worksuite/module-settings-types';

/**
 * Worksuite per-module settings actions.
 *
 * Four of these collections are *singletons* per tenant:
 *   - crm_invoice_settings
 *   - crm_task_settings
 *   - crm_project_settings
 *   - crm_attendance_settings
 *
 * For singletons we upsert on `userId` and the page loads the single
 * row via `get<Entity>Settings()`. For the remaining three multi-row
 * collections we re-use the generic HR CRUD helpers so the pages can
 * plug straight into `HrEntityPage`.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  invoice: 'crm_invoice_settings',
  task: 'crm_task_settings',
  project: 'crm_project_settings',
  projectStatus: 'crm_project_status_settings',
  attendance: 'crm_attendance_settings',
  expenseCategoryRole: 'crm_expense_category_roles',
  currencyFormat: 'crm_currency_format_settings',
} as const;

const PATHS = {
  invoice: '/dashboard/crm/settings/invoice-settings',
  task: '/dashboard/crm/settings/task-settings',
  project: '/dashboard/crm/settings/project-settings',
  projectStatus: '/dashboard/crm/settings/project-statuses',
  attendance: '/dashboard/crm/settings/attendance-settings',
  expenseCategoryRole: '/dashboard/crm/settings/expense-category-roles',
  currencyFormat: '/dashboard/crm/settings/currency-formats',
} as const;

/* ───────────────── Helpers ───────────────── */

function coerceBool(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  const v = String(val).toLowerCase();
  return v === 'true' || v === 'yes' || v === '1' || v === 'on';
}

function coerceNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse an IP whitelist coming from a textarea (newline or comma separated). */
function parseIpList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return String(raw)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function upsertSingleton(
  collection: string,
  revalidate: string,
  data: Record<string, unknown>,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(collection).updateOne(
    { userId: new ObjectId(user._id) },
    {
      $set: { ...data, userId: new ObjectId(user._id), updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  revalidatePath(revalidate);
  return { message: 'Settings saved.' };
}

async function getSingleton<T>(collection: string): Promise<T | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(collection)
    .findOne({ userId: new ObjectId(user._id) });
  return doc ? (serialize(doc) as unknown as T) : null;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Invoice Settings (singleton)
 * ══════════════════════════════════════════════════════════════════ */

const INVOICE_BOOLS = [
  'show_tax_column',
  'show_notes',
  'show_terms',
  'enable_einvoice',
  'enable_qr_code',
  'send_reminder_before_due',
] as const;

const INVOICE_NUMS = ['invoice_digit', 'due_after_days', 'reminder_days_before'] as const;

export async function getInvoiceSettings(): Promise<WsInvoiceSetting | null> {
  return getSingleton<WsInvoiceSetting>(COLS.invoice);
}

export async function saveInvoiceSettings(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    delete raw._id;
    const data: Record<string, unknown> = {
      invoice_prefix: raw.invoice_prefix ?? '',
      invoice_number_separator: raw.invoice_number_separator ?? '-',
      tax_calculation: raw.tax_calculation ?? 'before-discount',
      default_note: raw.default_note ?? '',
      default_terms: raw.default_terms ?? '',
      hsn_sac_label: raw.hsn_sac_label ?? '',
    };
    for (const k of INVOICE_NUMS) data[k] = coerceNumber(raw[k]);
    for (const k of INVOICE_BOOLS) data[k] = coerceBool(raw[k]);
    return upsertSingleton(COLS.invoice, PATHS.invoice, data);
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Task Settings (singleton)
 * ══════════════════════════════════════════════════════════════════ */

const TASK_BOOLS = [
  'enable_subtasks',
  'enable_dependencies',
  'enable_recurring_tasks',
  'enable_time_logs',
  'enable_task_ratings',
  'auto_assign_creator',
  'require_due_date',
] as const;

export async function getTaskSettings(): Promise<WsTaskSetting | null> {
  return getSingleton<WsTaskSetting>(COLS.task);
}

export async function saveTaskSettings(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    delete raw._id;
    const data: Record<string, unknown> = {
      default_priority: raw.default_priority ?? 'medium',
    };
    for (const k of TASK_BOOLS) data[k] = coerceBool(raw[k]);
    return upsertSingleton(COLS.task, PATHS.task, data);
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Settings (singleton)
 * ══════════════════════════════════════════════════════════════════ */

const PROJECT_BOOLS = [
  'enable_milestones',
  'enable_time_tracking',
  'enable_kanban',
  'enable_gantt',
  'enable_client_portal',
  'require_client',
  'require_deadline',
] as const;

export async function getProjectSettings(): Promise<WsProjectSetting | null> {
  return getSingleton<WsProjectSetting>(COLS.project);
}

export async function saveProjectSettings(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    delete raw._id;
    const data: Record<string, unknown> = {
      default_status: raw.default_status ?? '',
      default_priority: raw.default_priority ?? 'medium',
    };
    for (const k of PROJECT_BOOLS) data[k] = coerceBool(raw[k]);
    return upsertSingleton(COLS.project, PATHS.project, data);
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Project Status Settings (multi-row)
 * ══════════════════════════════════════════════════════════════════ */

export async function getProjectStatusSettings() {
  return hrList<WsProjectStatusSetting>(COLS.projectStatus, {
    sortBy: { priority: 1, status_name: 1 },
  });
}

export async function saveProjectStatusSetting(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, ['priority']);
    for (const k of ['is_final', 'is_default']) data[k] = coerceBool(data[k]);
    if (!data.slug && typeof data.status_name === 'string') {
      data.slug = data.status_name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    const res = await hrSave(COLS.projectStatus, data);
    if (res.error) return { error: res.error };
    revalidatePath(PATHS.projectStatus);
    return { message: 'Status saved.', id: res.id };
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

export async function deleteProjectStatusSetting(id: string) {
  const r = await hrDelete(COLS.projectStatus, id);
  revalidatePath(PATHS.projectStatus);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Attendance Settings (singleton)
 * ══════════════════════════════════════════════════════════════════ */

const ATTENDANCE_BOOLS = [
  'allow_web_checkin',
  'allow_mobile_checkin',
  'require_location',
  'work_from_home_allowed',
  'require_approval',
  'auto_clock_out',
] as const;

const ATTENDANCE_NUMS = [
  'office_hours',
  'late_mark_after',
  'early_clock_in_allowed',
  'half_day_after',
] as const;

export async function getAttendanceSettings(): Promise<WsAttendanceSetting | null> {
  return getSingleton<WsAttendanceSetting>(COLS.attendance);
}

export async function saveAttendanceSettings(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const raw = formToObject(formData);
    delete raw._id;
    const data: Record<string, unknown> = {
      office_start_time: raw.office_start_time ?? '09:00',
      office_end_time: raw.office_end_time ?? '18:00',
      allowed_ip_addresses: parseIpList(raw.allowed_ip_addresses),
    };
    for (const k of ATTENDANCE_NUMS) data[k] = coerceNumber(raw[k]);
    for (const k of ATTENDANCE_BOOLS) data[k] = coerceBool(raw[k]);
    return upsertSingleton(COLS.attendance, PATHS.attendance, data);
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Expense Category ↔ Role (multi-row)
 * ══════════════════════════════════════════════════════════════════ */

export async function getExpenseCategoryRoles() {
  return hrList<WsExpenseCategoryRole>(COLS.expenseCategoryRole);
}

export async function saveExpenseCategoryRole(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData);
    for (const k of ['can_approve', 'can_create']) data[k] = coerceBool(data[k]);
    const res = await hrSave(COLS.expenseCategoryRole, data, {
      idFields: ['expense_category_id', 'role_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(PATHS.expenseCategoryRole);
    return { message: 'Saved.', id: res.id };
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

export async function deleteExpenseCategoryRole(id: string) {
  const r = await hrDelete(COLS.expenseCategoryRole, id);
  revalidatePath(PATHS.expenseCategoryRole);
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Currency Format Settings (multi-row)
 * ══════════════════════════════════════════════════════════════════ */

export async function getCurrencyFormatSettings() {
  return hrList<WsCurrencyFormatSetting>(COLS.currencyFormat);
}

export async function saveCurrencyFormatSetting(
  _prev: unknown,
  formData: FormData,
): Promise<FormState> {
  try {
    const data = formToObject(formData, ['decimal_digits', 'no_of_decimal']);
    const res = await hrSave(COLS.currencyFormat, data, {
      idFields: ['currency_id'],
    });
    if (res.error) return { error: res.error };
    revalidatePath(PATHS.currencyFormat);
    return { message: 'Saved.', id: res.id };
  } catch (e) {
    return { error: (e as Error)?.message || 'Failed to save' };
  }
}

export async function deleteCurrencyFormatSetting(id: string) {
  const r = await hrDelete(COLS.currencyFormat, id);
  revalidatePath(PATHS.currencyFormat);
  return r;
}
