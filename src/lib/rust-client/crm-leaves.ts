import 'server-only';

/**
 * CRM Leave Applications client — wraps `/v1/crm/leaves/applications`.
 *
 * Counterpart of the Rust crate `crm-leaves` (the `applications`
 * subtree; the `types` catalog is a separate sub-feature). The Rust
 * handlers return the full `LeaveApplication` document on every read /
 * write endpoint; this module narrows the shape into a TS-friendly
 * `CrmLeaveDoc` and exposes a small, focused CRUD surface for the UI.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror hrm_payroll_types::LeaveApplication ─── */

export type CrmLeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CrmLeaveApproverStep {
  approverId?: string;
  status?: CrmLeaveStatus;
  decidedAt?: string;
  comment?: string;
}

export interface CrmLeaveAttachment {
  fileId?: string;
  name?: string;
  url?: string;
  mime?: string;
  size?: number;
}

/**
 * Wire shape of a `LeaveApplication`. §0 fragments (`Identity`,
 * `Audit`, `Assignment`) are flattened by the Rust serializer, so the
 * document carries `_id`, `userId`, `projectId`, audit timestamps, and
 * `assignedTo` at the root.
 */
export interface CrmLeaveDoc {
  _id: string;
  /* flattened §0 — Identity */
  projectId?: string;
  userId?: string;
  tenantId?: string;
  /* flattened §0 — Audit */
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  /* flattened §0 — Assignment (applicant lives here) */
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: string;

  /* request body */
  leaveTypeId: string;
  from: string;
  to: string;
  halfDay?: boolean;
  days: number;
  reason?: string;
  attachments?: CrmLeaveAttachment[];

  /* workflow */
  approverChain?: CrmLeaveApproverStep[];
  status: CrmLeaveStatus;
  balanceSnapshot?: number;
}

export interface CrmLeaveListParams {
  page?: number;
  limit?: number;
  /** Optional applicant (24-char hex) — matches the flattened `assignedTo`. */
  employeeId?: string;
  /** Optional status filter. */
  status?: CrmLeaveStatus;
}

export interface CrmLeaveCreateInput {
  /** 24-char hex of the parent `LeaveType`. Required. */
  leaveTypeId: string;
  /** Inclusive start — ISO 8601. */
  from: string;
  /** Inclusive end — ISO 8601. */
  to: string;
  halfDay?: boolean;
  reason?: string;
  attachments?: CrmLeaveAttachment[];
  /** Optional applicant override. When omitted the caller is the applicant. */
  employeeId?: string;
  projectId?: string;
}

export type CrmLeaveUpdateInput = Partial<
  Omit<CrmLeaveCreateInput, 'projectId' | 'employeeId'>
>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmLeaveListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.employeeId) qs.set('employeeId', p.employeeId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLeavesApi = {
  list: (params?: CrmLeaveListParams) =>
    rustFetch<CrmLeaveDoc[]>(`/v1/crm/leaves/applications${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmLeaveDoc>(`/v1/crm/leaves/applications/${encodeURIComponent(id)}`),
  create: (input: CrmLeaveCreateInput) =>
    rustFetch<CrmLeaveDoc>('/v1/crm/leaves/applications', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmLeaveUpdateInput) =>
    rustFetch<CrmLeaveDoc>(`/v1/crm/leaves/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/leaves/applications/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};

/* ─── Leave-type catalog (read-only helper) ────────────────────── */
//
// The catalog itself is managed under `/dashboard/crm/hr-payroll/
// leave/types/` (a separate sub-feature) — we only need a thin reader
// here so the application form can offer a typed dropdown of valid
// `leaveTypeId` values. Full CRUD lives in the dedicated sub-feature.

export interface CrmLeaveTypeOption {
  _id: string;
  code: string;
  name: string;
  paid?: boolean;
}

export const crmLeaveTypesApi = {
  /** Returns up to 100 leave types — enough for the form dropdown. */
  list: () =>
    rustFetch<CrmLeaveTypeOption[]>('/v1/crm/leaves/types?limit=100'),
};
