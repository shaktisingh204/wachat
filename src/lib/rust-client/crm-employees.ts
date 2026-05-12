import 'server-only';

/**
 * CRM Employee client — wraps `/v1/crm/employees`.
 *
 * Counterpart of the Rust crate `crm-employees`. The Rust handlers
 * return the full `Employee` document (a flattened union of `Identity`,
 * `Audit`, `Assignment`, `PersonalProfile`, `EmploymentProfile`, and
 * `EmployeeDocuments`) on every endpoint; this module narrows the shape
 * into a TS-friendly `CrmEmployeeDoc` and provides camelCase access for
 * the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror hrm_payroll_types::Employee ─────────── */

export type CrmEmployeeGender =
  | 'male'
  | 'female'
  | 'non_binary'
  | 'other'
  | 'prefer_not_to_say';

export type CrmEmployeeStatus = 'active' | 'on_leave' | 'terminated' | 'resigned';

export type CrmEmployeeType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'intern'
  | 'consultant';

/**
 * Single address block as returned on the employee document. Mirrors
 * `crm_sales_types::Address` — every field is optional because India
 * KYC paperwork frequently only carries the pin and state.
 */
export interface CrmEmployeeAddressBlock {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}

export interface CrmEmployeeDoc {
  _id: string;
  /* ----- crm-core fragments (flattened to root) ----- */
  projectId?: string;
  userId?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;

  /* ----- personal (flattened) ----- */
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  dob?: string;
  gender?: CrmEmployeeGender;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | 'other';
  bloodGroup?: string;
  nationality?: string;
  languages?: string[];
  photoFileId?: string;
  personalEmail?: string;
  personalPhone?: string;
  address?: {
    current?: CrmEmployeeAddressBlock;
    permanent?: CrmEmployeeAddressBlock;
  };

  /* ----- employment (flattened) ----- */
  employeeId?: string;
  joiningDate?: string;
  confirmationDate?: string;
  probationEnd?: string;
  employmentType?: CrmEmployeeType;
  departmentId?: string;
  designation?: string;
  designationId?: string;
  reportingManagerId?: string;
  dottedLineManagerId?: string;
  workLocation?: string;
  shiftId?: string;
  workEmail?: string;
  workPhone?: string;
  extension?: string;
  salaryStructureId?: string;
  ctc?: number;
  variablePct?: number;
  noticePeriodDays?: number;
  status?: CrmEmployeeStatus;
  exitDate?: string;
  exitReason?: string;

  /* ----- bag-of-data fragments ----- */
  customFields?: Record<string, unknown>;
  tags?: string[];
  archived?: boolean;
}

export interface CrmEmployeeListParams {
  page?: number;
  limit?: number;
  q?: string;
  departmentId?: string;
  designationId?: string;
  status?: CrmEmployeeStatus | string;
}

/**
 * Wire shape for `POST /v1/crm/employees`. Mirrors
 * `crm_employees::dto::CreateEmployeeInput` exactly — required fields
 * are non-optional here, optional fields use `?`.
 *
 * Dates are ISO-8601 strings (chrono deserializes them server-side).
 */
export interface CrmEmployeeCreateInput {
  /* identity (optional override) */
  projectId?: string;

  /* required */
  firstName: string;
  lastName: string;
  dob: string;
  joiningDate: string;
  departmentId: string;
  designationId: string;
  workEmail: string;
  salaryStructureId: string;

  /* optional — name */
  displayName?: string;
  salutation?: string;

  /* optional — demographics */
  gender?: CrmEmployeeGender;

  /* optional — contact */
  personalEmail?: string;
  personalPhone?: string;
  workPhone?: string;

  /* optional — employment */
  employmentType?: CrmEmployeeType;
  reportingManagerId?: string;
  dottedLineManagerId?: string;
  ctc?: number;
  variablePct?: number;
  noticePeriodDays?: number;
  status?: CrmEmployeeStatus;
}

export type CrmEmployeeUpdateInput = Partial<
  Omit<CrmEmployeeCreateInput, 'projectId'>
>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmEmployeeListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.departmentId) qs.set('departmentId', p.departmentId);
  if (p.designationId) qs.set('designationId', p.designationId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmEmployeesApi = {
  list: (params?: CrmEmployeeListParams) =>
    rustFetch<CrmEmployeeDoc[]>(`/v1/crm/employees${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmEmployeeDoc>(`/v1/crm/employees/${encodeURIComponent(id)}`),
  create: (input: CrmEmployeeCreateInput) =>
    rustFetch<CrmEmployeeDoc>('/v1/crm/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmEmployeeUpdateInput) =>
    rustFetch<CrmEmployeeDoc>(`/v1/crm/employees/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/employees/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
