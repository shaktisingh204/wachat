'use client';

/**
 * Client side of the Employees list — owns the search box, the table,
 * and the hard-delete confirmation dialog. Search input is debounced
 * and writes back to the URL so the server component re-fetches.
 *
 * Relational columns (Department, Designation) are resolved on the
 * client via `<EntityPickerChip>` so the table renders human labels
 * even though the Rust list endpoint only ships ObjectId FKs.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deleteEmployeeAction } from '@/app/actions/crm/employees.actions';
import type {
  CrmEmployeeDoc,
  CrmEmployeeStatus,
} from '@/lib/rust-client/crm-employees';

interface EmployeeListClientProps {
  employees: CrmEmployeeDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fullName(e: CrmEmployeeDoc): string {
  return (
    e.displayName ||
    [e.firstName, e.lastName].filter(Boolean).join(' ') ||
    e.workEmail ||
    'Unnamed'
  );
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/**
 * Map the canonical employment status to a UI-friendly label + badge
 * variant. Unknown values fall through to the raw label rendered with
 * the neutral `outline` variant.
 */
function statusBadge(status?: CrmEmployeeStatus | string) {
  if (!status) return null;
  const map: Record<
    string,
    { label: string; variant: 'outline' | 'success' | 'danger' | 'warning' | 'secondary' }
  > = {
    active: { label: 'Active', variant: 'success' },
    on_leave: { label: 'On leave', variant: 'warning' },
    terminated: { label: 'Terminated', variant: 'danger' },
    resigned: { label: 'Resigned', variant: 'outline' },
  };
  const hit = map[status];
  return <ZoruBadge variant={hit?.variant ?? 'outline'}>{hit?.label ?? status}</ZoruBadge>;
}

export function EmployeeListClient({
  employees,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: EmployeeListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmEmployeeDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const name = fullName(pendingDelete);
    startDelete(async () => {
      const res = await deleteEmployeeAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${name} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, employee code…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Code</ZoruTableHead>
            <ZoruTableHead>Department</ZoruTableHead>
            <ZoruTableHead>Designation</ZoruTableHead>
            <ZoruTableHead>Work email</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Joined</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {employees.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                {initialQuery
                  ? 'No employees match this search.'
                  : 'No employees yet — click "New employee" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            employees.map((emp) => {
              const id = String(emp._id);
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/hr-payroll/employees/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {fullName(emp)}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted tabular-nums">
                    {emp.employeeId || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px]">
                    {emp.departmentId ? (
                      <EntityPickerChip entity="department" id={emp.departmentId} />
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px]">
                    {emp.designationId ? (
                      <EntityPickerChip entity="designation" id={emp.designationId} />
                    ) : emp.designation ? (
                      <span className="text-zoru-ink-muted">{emp.designation}</span>
                    ) : (
                      <span className="text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {emp.workEmail || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {statusBadge(emp.status) ?? (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(emp.joiningDate)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/hr-payroll/employees/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(emp)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete employee?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes <strong>{pendingDelete ? fullName(pendingDelete) : ''}</strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
