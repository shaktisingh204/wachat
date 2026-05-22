'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  MoreHorizontal,
  UserCircle2,
} from 'lucide-react';

/**
 * <EmployeesTable> — table-view body for the canonical Employees list.
 *
 * Upgraded to use spreadsheet-style `<CrmBulkyGrid>` for comfortable dense
 * layout, column sorting, status updates via double-click dropdowns.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';

import type { EmployeeListRow } from './types';

interface EmployeesTableProps {
  rows: EmployeeListRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  inlineEditRowId: string | null;
  editBuffer: any;
  onStartInlineEdit: (row: EmployeeListRow) => void;
  onCancelInlineEdit: () => void;
  onSaveInlineEdit: (id: string, updatedFields: Partial<EmployeeListRow>) => Promise<void>;
  onUpdateEditBuffer: (field: keyof EmployeeListRow, value: any) => void;
  isLoading?: boolean;
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtTenure(joining?: string | null, exit?: string | null): string {
  if (!joining) return '—';
  const start = new Date(joining);
  if (Number.isNaN(start.getTime())) return '—';
  const end = exit ? new Date(exit) : new Date();
  if (Number.isNaN(end.getTime())) return '—';
  const months = Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375),
    ),
  );
  if (months < 1) return '<1 mo';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remM = months % 12;
  return remM === 0 ? `${years}y` : `${years}y ${remM}m`;
}

function fmtMoney(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `INR ${value}`;
  }
}

function fullName(row: EmployeeListRow): string {
  return (
    row.displayName ||
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.workEmail ||
    '—'
  );
}

function statusLabel(s?: string): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

export function EmployeesTable({
  rows,
  selected,
  onToggleRow,
  onToggleAll,
  inlineEditRowId,
  editBuffer,
  onStartInlineEdit,
  onCancelInlineEdit,
  onSaveInlineEdit,
  onUpdateEditBuffer,
  isLoading = false,
}: EmployeesTableProps) {
  const columns = React.useMemo<ColumnDef<EmployeeListRow>[]>(() => [
    {
      key: 'firstName',
      header: 'Employee',
      sortable: true,
      render: (row) => {
        const id = row._id;
        const name = fullName(row);
        return (
          <Link
            href={`/dashboard/hrm/payroll/employees/${id}`}
            className="inline-flex items-center gap-2 text-zoru-ink hover:underline"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zoru-line bg-zoru-surface text-zoru-ink-muted">
              <UserCircle2 className="h-4 w-4" />
            </span>
            <span className="font-medium text-zoru-ink">{name}</span>
          </Link>
        );
      },
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[12px] text-zoru-ink">{row.employeeId || '—'}</span>
      ),
    },
    {
      key: 'departmentId',
      header: 'Department',
      sortable: true,
      render: (row) => (
        row.departmentId ? (
          <EntityPickerChip entity="department" id={row.departmentId} />
        ) : (
          <span className="text-zoru-ink-muted">—</span>
        )
      ),
    },
    {
      key: 'designationId',
      header: 'Designation',
      sortable: true,
      render: (row) => (
        row.designationId ? (
          <EntityPickerChip entity="designation" id={row.designationId} />
        ) : (
          <span className="text-zoru-ink-muted">{row.designation || '—'}</span>
        )
      ),
    },
    {
      key: 'workEmail',
      header: 'Email',
      sortable: true,
      render: (row) => <span className="text-zoru-ink">{row.workEmail || '—'}</span>,
    },
    {
      key: 'workPhone',
      header: 'Phone',
      sortable: true,
      render: (row) => (
        <span className="text-zoru-ink-muted">{row.workPhone || row.personalPhone || '—'}</span>
      ),
    },
    {
      key: 'reportingManagerId',
      header: 'Reporting manager',
      sortable: true,
      render: (row) => (
        row.reportingManagerId ? (
          <EntityPickerChip entity="employee" id={row.reportingManagerId} />
        ) : (
          <span className="text-zoru-ink-muted">—</span>
        )
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => {
        if (!row.status) return <span className="text-zoru-ink-muted">—</span>;
        return (
          <StatusPill
            label={statusLabel(row.status)}
            tone={statusToTone(row.status)}
          />
        );
      },
      editRender: (row, value, onChange) => (
        <select
          className="bg-zoru-surface-2 border border-zoru-line rounded px-1.5 py-0.5 text-xs text-zoru-ink focus:outline-none"
          value={value || 'active'}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="resigned">Resigned</option>
          <option value="terminated">Terminated</option>
          <option value="suspended">Suspended</option>
          <option value="probation">Probation</option>
        </select>
      ),
    },
    {
      key: 'joiningDate',
      header: 'Joined',
      sortable: true,
      render: (row) => <span className="text-zoru-ink">{fmtDate(row.joiningDate)}</span>,
    },
    {
      key: 'exitDate',
      header: 'Tenure',
      render: (row) => (
        <span className="text-zoru-ink">{fmtTenure(row.joiningDate, row.exitDate)}</span>
      ),
    },
    {
      key: 'ctc',
      header: 'Salary',
      sortable: true,
      render: (row) => (
        <span className="font-mono tabular-nums text-zoru-ink">{fmtMoney(row.ctc)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => {
        const id = row._id;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Row actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent>
                <ZoruDropdownMenuItem asChild>
                  <Link href={`/dashboard/hrm/payroll/employees/${id}`}>
                    View
                  </Link>
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/hrm/payroll/employees/${id}/edit`}
                  >
                    Edit
                  </Link>
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/hrm/payroll/employees/${id}/activity`}
                  >
                    Activity
                  </Link>
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], []);

  return (
    <div className="overflow-hidden bg-zoru-surface">
      <CrmBulkyGrid<EmployeeListRow>
        columns={columns}
        data={rows}
        selectedIds={selected}
        onSelectOne={onToggleRow}
        onSelectAll={onToggleAll}
        density="comfortable"
        inlineEditRowId={inlineEditRowId}
        editBuffer={editBuffer}
        onStartInlineEdit={onStartInlineEdit}
        onCancelInlineEdit={onCancelInlineEdit}
        onSaveInlineEdit={onSaveInlineEdit}
        onUpdateEditBuffer={onUpdateEditBuffer}
        isLoading={isLoading}
      />
    </div>
  );
}

