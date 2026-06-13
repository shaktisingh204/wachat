import 'server-only';

/**
 * SabCRM People — Employees client. Wraps the project-scoped
 * `/v1/sabcrm/people/employees` mount (P7 People suite, spec
 * `docs/sabcrm/rnd/people-suite.md` WI-16/WI-24).
 *
 * Every method takes the SabCRM `projectId` first and appends it as
 * `?projectId=` (GET/PATCH/DELETE) or injects it into the body (POST) —
 * the engine mount is `ScopeMode::Project` and rejects requests without
 * it (`crm_core::scope::sabcrm_project_oid`).
 *
 * Response/document types are re-exported from the legacy
 * `crm-employees.ts` client — they are already camelCase-faithful to
 * `hrm_payroll_types::Employee`.
 *
 * This file also carries the SMALL read-only option fetchers the
 * employee form needs from sibling People mounts (shifts, rich salary
 * structures) plus the activity-rail reads (attendance / leave
 * applications / payslips for one employee). They live HERE — not in a
 * shared client — so parallel surface agents never edit the same file.
 *
 * Engine responses serialize `ObjectId`/`DateTime` as Mongo extended
 * JSON (`{$oid}`/`{$date}` — the gen-1 models use the bson serde
 * helpers); every read below deflates them back into the plain scalars
 * the declared TS types advertise. Input DTOs are unaffected (the
 * crate DTOs use plain chrono serde — RFC3339 strings).
 */

import { rustFetch } from './fetcher';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import type {
  CrmEmployeeCreateInput,
  CrmEmployeeDoc,
  CrmEmployeeUpdateInput,
} from './crm-employees';

export type {
  CrmEmployeeAddressBlock,
  CrmEmployeeCreateInput,
  CrmEmployeeDoc,
  CrmEmployeeGender,
  CrmEmployeeStatus,
  CrmEmployeeType,
  CrmEmployeeUpdateInput,
} from './crm-employees';

/* ─── Extra document slices (read-rendered on the detail page) ──── */

/**
 * Fields stored on the Employee document beyond the legacy client's
 * narrowed `CrmEmployeeDoc` (statutory, bank, documents, skills &
 * history fragments of `hrm_payroll_types::Employee`). All optional —
 * present only when some writer populated them.
 */
export interface SabcrmEmployeeDocExtras {
  maritalStatus?: string;
  spouse?: string;
  children?: { name: string; dob?: string; gender?: string }[];
  religion?: string;
  emergencyContact?: { name: string; phone: string; relation: string };
  identityDocs?: {
    aadhaarMasked?: string;
    pan?: string;
    passportNo?: string;
    passportExpiry?: string;
    drivingLicence?: string;
    voterId?: string;
  };
  bank?: {
    accountNo: string;
    ifsc: string;
    bankName: string;
    branch?: string;
    nameOnAccount: string;
  };
  uan?: string;
  esicNo?: string;
  /* documents fragment */
  offerLetterFileId?: string;
  appointmentFileId?: string;
  contractFileId?: string;
  ndaFileId?: string;
  kycFiles?: string[];
  educationCertFiles?: string[];
  idProofFiles?: string[];
  visa?: {
    number: string;
    visaType: string;
    issued?: string;
    validTill?: string;
    country: string;
  };
  workPermitFileId?: string;
  /* skills & history fragment */
  skills?: { name: string; level?: string }[];
  certifications?: {
    name: string;
    issuer?: string;
    issued?: string;
    expiry?: string;
    fileId?: string;
  }[];
  education?: {
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    start?: string;
    end?: string;
    grade?: string;
  }[];
  pastEmployment?: {
    company: string;
    role: string;
    start?: string;
    end?: string;
    reasonForLeaving?: string;
  }[];
}

/** The full wire document the People mounts return. */
export type SabcrmEmployeeDoc = CrmEmployeeDoc & SabcrmEmployeeDocExtras;

/* ─── Query params ───────────────────────────────────────────────── */

export interface SabcrmEmployeeListParams {
  page?: number;
  limit?: number;
  q?: string;
  departmentId?: string;
  designationId?: string;
  status?: string;
}

function qs(
  projectId: string,
  extra?: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  sp.set('projectId', projectId);
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  return `?${sp.toString()}`;
}

const BASE = '/v1/sabcrm/people/employees';

/* ─── Employees CRUD ─────────────────────────────────────────────── */

export const sabcrmPeopleEmployeesApi = {
  list: async (projectId: string, p?: SabcrmEmployeeListParams) =>
    deflateDocs(
      await rustFetch<SabcrmEmployeeDoc[]>(
        `${BASE}${qs(projectId, {
          page: p?.page,
          limit: p?.limit,
          q: p?.q,
          departmentId: p?.departmentId,
          designationId: p?.designationId,
          status: p?.status,
        })}`,
      ),
    ),
  getById: async (projectId: string, id: string) =>
    deflateDoc(
      await rustFetch<SabcrmEmployeeDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      ),
    ),
  create: async (projectId: string, input: CrmEmployeeCreateInput) =>
    deflateDoc(
      await rustFetch<SabcrmEmployeeDoc>(BASE, {
        method: 'POST',
        body: JSON.stringify({ ...input, projectId }),
      }),
    ),
  update: async (projectId: string, id: string, patch: CrmEmployeeUpdateInput) =>
    deflateDoc(
      await rustFetch<SabcrmEmployeeDoc>(
        `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
      ),
    ),
  delete: (projectId: string, id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs(projectId)}`,
      { method: 'DELETE' },
    ),
};

/* ─── Picker option reads over sibling People mounts ─────────────── */

/** Loose shift document slice (picker label only). */
export interface SabcrmShiftOptionDoc {
  _id: string;
  name?: string;
  code?: string;
  startTime?: string;
  endTime?: string;
}

/** Loose RICH salary-structure slice (picker label only — WI-8 shape). */
export interface SabcrmSalaryStructureOptionDoc {
  _id: string;
  name?: string;
  effectiveDate?: string;
  active?: boolean;
}

export const sabcrmPeopleEmployeeOptionsApi = {
  searchShifts: async (projectId: string, q?: string) =>
    deflateDocs(
      await rustFetch<SabcrmShiftOptionDoc[]>(
        `/v1/sabcrm/people/shifts${qs(projectId, { q, limit: 20 })}`,
      ),
    ),
  getShift: async (projectId: string, id: string) =>
    deflateDoc(
      await rustFetch<SabcrmShiftOptionDoc>(
        `/v1/sabcrm/people/shifts/${encodeURIComponent(id)}${qs(projectId)}`,
      ),
    ),
  searchSalaryStructures: async (projectId: string, q?: string) =>
    deflateDocs(
      await rustFetch<SabcrmSalaryStructureOptionDoc[]>(
        `/v1/sabcrm/people/salary-structures${qs(projectId, { q, limit: 20 })}`,
      ),
    ),
  getSalaryStructure: async (projectId: string, id: string) =>
    deflateDoc(
      await rustFetch<SabcrmSalaryStructureOptionDoc>(
        `/v1/sabcrm/people/salary-structures/${encodeURIComponent(id)}${qs(projectId)}`,
      ),
    ),
};

/* ─── Activity-rail reads (employee detail, WI-24 Activity tab) ──── */

/** Loose attendance slice for the last-30-days rail. */
export interface SabcrmEmployeeAttendanceSlice {
  _id: string;
  date?: string;
  status?: string;
  totalHours?: number;
}

/** Loose leave-application slice for the rail. */
export interface SabcrmEmployeeLeaveSlice {
  _id: string;
  from?: string;
  to?: string;
  days?: number;
  status?: string;
  leaveTypeId?: string;
}

/** Loose payslip slice (unified WI-9 DTO — flat or rich). */
export interface SabcrmEmployeePayslipSlice {
  _id: string;
  payPeriod?: string;
  periodLabel?: string;
  net?: number;
  netPay?: number;
  status?: string;
  runId?: string;
}

export const sabcrmPeopleEmployeeActivityApi = {
  listAttendance: async (
    projectId: string,
    employeeId: string,
    dateFromIso: string,
  ) =>
    deflateDocs(
      await rustFetch<SabcrmEmployeeAttendanceSlice[]>(
        `/v1/sabcrm/people/attendance${qs(projectId, {
          employeeId,
          dateFrom: dateFromIso,
          limit: 100,
        })}`,
      ),
    ),
  listLeaveApplications: async (projectId: string, employeeId: string) =>
    deflateDocs(
      await rustFetch<SabcrmEmployeeLeaveSlice[]>(
        `/v1/sabcrm/people/leaves/applications${qs(projectId, {
          employeeId,
          limit: 50,
        })}`,
      ),
    ),
  listPayslips: async (projectId: string, employeeId: string) =>
    deflateDocs(
      await rustFetch<SabcrmEmployeePayslipSlice[]>(
        `/v1/sabcrm/people/payslips${qs(projectId, { employeeId, limit: 50 })}`,
      ),
    ),
};
