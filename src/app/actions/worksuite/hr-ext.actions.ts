'use server';

import { revalidatePath } from 'next/cache';
import { hrList, hrGetById, hrSave, hrDelete, formToObject } from '@/lib/hr-crud';
import type {
  WsEmployeeDetail,
  WsEmployeeDocument,
  WsEmergencyContact,
  WsVisaDetail,
  WsSkill,
  WsEmployeeSkill,
  WsEmployeeTeam,
  WsEmployeeLeaveQuota,
  WsEmployeeLeaveQuotaHistory,
} from '@/lib/worksuite/hr-ext-types';

type FormState = { message?: string; error?: string; id?: string };

const ROUTE_BASE = '/dashboard/hrm/payroll/employees';

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
    booleanKeys?: string[];
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave as string */
        }
      }
    }
    for (const k of options.booleanKeys || []) {
      if (data[k] !== undefined) {
        data[k] = data[k] === 'true' || data[k] === 'on' || data[k] === true;
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ── Employee Details ───────────────────────────────────────────── */

const COL_DETAILS = 'crm_employee_details';

export async function getEmployeeDetails() {
  return hrList<WsEmployeeDetail>(COL_DETAILS);
}
export async function getEmployeeDetailById(id: string) {
  return hrGetById<WsEmployeeDetail>(COL_DETAILS, id);
}
export async function getEmployeeDetailByEmployeeId(employeeId: string) {
  const all = await hrList<WsEmployeeDetail>(COL_DETAILS);
  return (all as any[]).find((d: any) => String(d.employee_id) === employeeId) ?? null;
}
export async function saveEmployeeDetail(_prev: any, formData: FormData) {
  return genericSave(COL_DETAILS, `${ROUTE_BASE}`, formData, {
    dateFields: [
      'joining_date',
      'last_date',
      'probation_end_date',
      'notice_period_end_date',
      'internship_end_date',
      'contract_end_date',
      'date_of_birth',
      'marriage_anniversary_date',
    ],
    numericKeys: ['notice_period', 'overtime_hourly_rate', 'hourly_rate'],
    booleanKeys: ['work_anniversary_notified'],
    jsonKeys: ['languages'],
  });
}
export async function deleteEmployeeDetail(id: string) {
  const r = await hrDelete(COL_DETAILS, id);
  revalidatePath(ROUTE_BASE);
  return r;
}

/* ── Employee Documents ─────────────────────────────────────────── */

const COL_DOCS = 'crm_employee_documents';

export async function getEmployeeDocuments() {
  return hrList<WsEmployeeDocument>(COL_DOCS);
}
export async function saveEmployeeDocument(_prev: any, formData: FormData) {
  return genericSave(COL_DOCS, `${ROUTE_BASE}/documents`, formData, {
    dateFields: ['uploaded_at', 'expiry_date'],
  });
}
export async function deleteEmployeeDocument(id: string) {
  const r = await hrDelete(COL_DOCS, id);
  revalidatePath(`${ROUTE_BASE}/documents`);
  return r;
}

/* ── Emergency Contacts ─────────────────────────────────────────── */

const COL_EMERGENCY = 'crm_emergency_contacts';

export async function getEmergencyContacts() {
  return hrList<WsEmergencyContact>(COL_EMERGENCY);
}
export async function saveEmergencyContact(_prev: any, formData: FormData) {
  return genericSave(COL_EMERGENCY, `${ROUTE_BASE}/emergency-contacts`, formData);
}
export async function deleteEmergencyContact(id: string) {
  const r = await hrDelete(COL_EMERGENCY, id);
  revalidatePath(`${ROUTE_BASE}/emergency-contacts`);
  return r;
}

/* ── Visa Details ───────────────────────────────────────────────── */

const COL_VISA = 'crm_visa_details';

export async function getVisaDetails() {
  return hrList<WsVisaDetail>(COL_VISA);
}
export async function saveVisaDetail(_prev: any, formData: FormData) {
  return genericSave(COL_VISA, `${ROUTE_BASE}/visa-details`, formData, {
    dateFields: ['issue_date', 'expiry_date'],
  });
}
export async function deleteVisaDetail(id: string) {
  const r = await hrDelete(COL_VISA, id);
  revalidatePath(`${ROUTE_BASE}/visa-details`);
  return r;
}

/* ── Skills master ──────────────────────────────────────────────── */

const COL_SKILLS = 'crm_skills';

export async function getSkills() {
  return hrList<WsSkill>(COL_SKILLS);
}
export async function saveSkill(_prev: any, formData: FormData) {
  return genericSave(COL_SKILLS, `${ROUTE_BASE}/skills`, formData);
}
export async function deleteSkill(id: string) {
  const r = await hrDelete(COL_SKILLS, id);
  revalidatePath(`${ROUTE_BASE}/skills`);
  return r;
}

/* ── Employee Skills (assignments) ──────────────────────────────── */

const COL_EMP_SKILLS = 'crm_employee_skills';

export async function getEmployeeSkills() {
  return hrList<WsEmployeeSkill>(COL_EMP_SKILLS);
}
export async function saveEmployeeSkill(_prev: any, formData: FormData) {
  return genericSave(COL_EMP_SKILLS, `${ROUTE_BASE}/employee-skills`, formData);
}
export async function deleteEmployeeSkill(id: string) {
  const r = await hrDelete(COL_EMP_SKILLS, id);
  revalidatePath(`${ROUTE_BASE}/employee-skills`);
  return r;
}

/* ── Employee Teams ─────────────────────────────────────────────── */

const COL_TEAMS = 'crm_employee_teams';

export async function getEmployeeTeams() {
  return hrList<WsEmployeeTeam>(COL_TEAMS);
}
export async function saveEmployeeTeam(_prev: any, formData: FormData) {
  return genericSave(COL_TEAMS, `${ROUTE_BASE}/teams`, formData);
}
export async function deleteEmployeeTeam(id: string) {
  const r = await hrDelete(COL_TEAMS, id);
  revalidatePath(`${ROUTE_BASE}/teams`);
  return r;
}

/* ── Leave Quotas ───────────────────────────────────────────────── */

const COL_QUOTAS = 'crm_employee_leave_quotas';
const COL_QUOTAS_HIST = 'crm_employee_leave_quota_history';

export async function getEmployeeLeaveQuotas() {
  return hrList<WsEmployeeLeaveQuota>(COL_QUOTAS);
}
export async function saveEmployeeLeaveQuota(_prev: any, formData: FormData) {
  return genericSave(COL_QUOTAS, `${ROUTE_BASE}/leave-quotas`, formData, {
    numericKeys: ['no_of_leaves'],
  });
}
export async function deleteEmployeeLeaveQuota(id: string) {
  const r = await hrDelete(COL_QUOTAS, id);
  revalidatePath(`${ROUTE_BASE}/leave-quotas`);
  return r;
}

export async function getEmployeeLeaveQuotaHistory() {
  return hrList<WsEmployeeLeaveQuotaHistory>(COL_QUOTAS_HIST);
}
export async function saveEmployeeLeaveQuotaHistory(_prev: any, formData: FormData) {
  return genericSave(COL_QUOTAS_HIST, `${ROUTE_BASE}/leave-quotas`, formData, {
    dateFields: ['changed_at'],
    numericKeys: ['change'],
  });
}
export async function deleteEmployeeLeaveQuotaHistory(id: string) {
  const r = await hrDelete(COL_QUOTAS_HIST, id);
  revalidatePath(`${ROUTE_BASE}/leave-quotas`);
  return r;
}
