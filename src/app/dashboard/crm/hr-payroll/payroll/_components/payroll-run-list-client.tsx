'use client';

/**
 * Client side of the Payroll Runs list — owns the status filter, the
 * table, and the hard-delete confirmation dialog. Filter input writes
 * back to the URL so the server component re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
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
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deletePayrollRunAction } from '@/app/actions/crm/payroll-runs.actions';
import type {
  CrmPayrollRunDoc,
  CrmPayrollRunStatus,
} from '@/lib/rust-client/crm-payroll-runs';

interface PayrollRunListClientProps {
  runs: CrmPayrollRunDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialStatus: string;
  error?: string;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'processing', label: 'Processing' },
  { value: 'approved', label: 'Approved' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'closed', label: 'Closed' },
];

// Sentinel because Radix Select can't store an empty string as a value.
const ALL_STATUSES = '__all__';

const STATUS_VARIANT: Record<
  CrmPayrollRunStatus,
  'outline' | 'secondary' | 'success' | 'info' | 'default'
> = {
  draft: 'outline',
  processing: 'info',
  approved: 'success',
  disbursed: 'success',
  closed: 'secondary',
};

function fmtMoney(value?: number): string {
  if (typeof value !== 'number') return '—';
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

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function periodLabel(run: CrmPayrollRunDoc): string {
  const from = fmtDate(run.periodFrom);
  const to = fmtDate(run.periodTo);
  return from === '—' && to === '—' ? '—' : `${from} – ${to}`;
}

function runLabel(run: CrmPayrollRunDoc): string {
  const period = periodLabel(run);
  return period === '—' ? `Run ${String(run._id).slice(-6)}` : `Run for ${period}`;
}

export function PayrollRunListClient({
  runs,
  page,
  limit,
  hasMore,
  initialStatus,
  error,
}: PayrollRunListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [pendingDelete, setPendingDelete] =
    React.useState<CrmPayrollRunDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  const onStatusChange = React.useCallback(
    (next: string) => {
      const normalized = next === ALL_STATUSES ? '' : next;
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (normalized) params.set('status', normalized);
      else params.delete('status');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, pathname, router],
  );

  const confirmDelete = React.useCallback(() => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = runLabel(pendingDelete);
    startDelete(async () => {
      const res = await deletePayrollRunAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  }, [pendingDelete, toast, router]);

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
          <span>Status</span>
          <ZoruSelect
            value={initialStatus ? initialStatus : ALL_STATUSES}
            onValueChange={onStatusChange}
          >
            <ZoruSelectTrigger className="h-9 w-[180px] text-[13px]">
              <ZoruSelectValue placeholder="All statuses" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <ZoruSelectItem
                  key={opt.value || ALL_STATUSES}
                  value={opt.value || ALL_STATUSES}
                >
                  {opt.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
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
            <ZoruTableHead>Run</ZoruTableHead>
            <ZoruTableHead>Period</ZoruTableHead>
            <ZoruTableHead>Pay date</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Employees</ZoruTableHead>
            <ZoruTableHead>Net</ZoruTableHead>
            <ZoruTableHead>Gross</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {runs.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={8}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {initialStatus
                  ? 'No payroll runs match this status.'
                  : 'No payroll runs yet — click "New payroll run" to start one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            runs.map((run) => {
              const id = String(run._id);
              const status = run.status;
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/hr-payroll/payroll/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {runLabel(run)}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {periodLabel(run)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(run.payDate)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {status ? (
                      <ZoruBadge variant={STATUS_VARIANT[status] ?? 'outline'}>
                        {status}
                      </ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {run.totals?.employeeCount ?? 0}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtMoney(run.totals?.net)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink-muted">
                    {fmtMoney(run.totals?.gross)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/payroll/${id}/edit`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(run)}
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
            <ZoruAlertDialogTitle>Delete payroll run?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{' '}
              <strong>{pendingDelete ? runLabel(pendingDelete) : ''}</strong>{' '}
              from the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
