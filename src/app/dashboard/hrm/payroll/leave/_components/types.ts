/**
 * Shared row + filter shapes for the canonical leave list (§1D).
 *
 * Decouples the list UI from the underlying data source. Today the live
 * data path is the legacy WorkSuite `WsLeave` collection (used for
 * approve/reject too); the form-edit path is the Rust `CrmLeaveDoc`.
 * Both can be mapped into this shape on the server.
 */

export type LeaveRowStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveListRow {
  _id: string;
  employeeId: string | null;
  employeeName: string;
  employeeEmail?: string;
  employeeUserId?: string;
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  leaveTypeColor: string | null;
  leaveTypeCode?: string | null;
  from: string | null;
  to: string | null;
  days: number;
  halfDay: boolean;
  reason: string | null;
  status: LeaveRowStatus;
  approverId: string | null;
  approverName: string | null;
  submittedAt: string | null;
  departmentId?: string | null;
}

export type LeaveViewMode = 'table' | 'calendar';

export type LeaveStatusFilter = 'all' | LeaveRowStatus;

export type LeavePreset = 'all' | 'my-leaves' | 'team-pending' | 'this-month';

export type LeaveKpiKey =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'balance'
  | 'used';

export interface LeaveKpiSnapshot {
  pending: number;
  approved: number;
  rejected: number;
  /** Available balance for the current user across all leave types. */
  availableBalance: number | null;
  /** Approved leave days falling in current month. */
  usedThisMonth: number;
}

export interface LeaveTypeOption {
  _id: string;
  name: string;
  color?: string | null;
  code?: string | null;
}
