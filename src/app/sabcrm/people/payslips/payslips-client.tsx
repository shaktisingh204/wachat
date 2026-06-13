'use client';

/**
 * SabCRM People — Payslips list client (`/sabcrm/people/payslips`,
 * WI-33).
 *
 * Doc-surface adopter over the WI-9 unified dual shape: rich
 * run-generated payslips (synthetic `generated` status, `runId`
 * lineage) and legacy flat CRUD rows share one list. Columns cover
 * period, employee (resolved label — never an ObjectId), gross /
 * deductions / net, sent + locked flags and the status cell.
 *
 * Toolbar: free-text search, status, employee picker and the period
 * date range; `?runId=` (from a payroll run's lineage rail) scopes the
 * list to one run and renders a dismissible banner. Bulk actions:
 * mark-sent (both shapes) and delete (flat rows only — the engine 409s
 * rich payslips, so rich selections are rejected with a clear error).
 *
 * Payslips are GENERATED documents — there is deliberately no create
 * button (read-only import surface; runs mint them via WI-7).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptText, Send, Trash2, X } from 'lucide-react';

import { Alert, Button } from '@/components/sabcrm/20ui';

import {
  DocListPage,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  PAYSLIP_STATUSES,
  PEOPLE_PAYSLIPS_PATH,
  payslipDetailHref,
  toPayslipFilters,
} from './payslips-config';

import {
  exportSabcrmPayslipRows,
  listSabcrmPayslipsPage,
  markSabcrmPayslipSent,
  deleteSabcrmPayslip,
  searchSabcrmPayslipEmployees,
} from '@/app/actions/sabcrm-people-payslips.actions';
import type { SabcrmPayslipListRow } from '@/app/actions/sabcrm-people-payslips.actions.types';

/* ─── Columns (unified dual-shape coverage per WI-33) ─────────── */

const COLUMNS: DocListColumn<SabcrmPayslipListRow>[] = [
  {
    key: 'period',
    header: 'Period',
    kind: 'text',
    value: (r) => r.periodLabel,
  },
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeLabel,
  },
  {
    key: 'gross',
    header: 'Gross',
    kind: 'money',
    value: (r) => r.gross,
    currency: (r) => r.currency,
  },
  {
    key: 'deductions',
    header: 'Deductions',
    kind: 'money',
    value: (r) => r.deductions,
    currency: (r) => r.currency,
  },
  {
    key: 'net',
    header: 'Net pay',
    kind: 'money',
    value: (r) => r.net,
    currency: (r) => r.currency,
  },
  {
    key: 'sent',
    header: 'Sent',
    kind: 'badge',
    value: (r) => (r.sent ? 'Sent' : null),
    tone: () => 'success',
  },
  {
    key: 'locked',
    header: 'Locked',
    kind: 'badge',
    value: (r) => (r.locked ? 'Locked' : null),
    tone: () => 'neutral',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface PayslipsClientProps {
  initialRows: SabcrmPayslipListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  /** Non-null when the list is deep-link scoped to one payroll run. */
  runId: string | null;
  initialFilters?: Partial<DocListFilters>;
}

export function PayslipsClient({
  initialRows,
  initialHasMore,
  initialError,
  runId,
  initialFilters,
}: PayslipsClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmPayslipListRow>>(
    () => ({
      title: 'Payslips',
      description:
        'Generated pay statements — frozen run payslips plus legacy manual rows, searchable by employee and period.',
      icon: ReceiptText,
      entity: { singular: 'payslip', plural: 'payslips' },
      columns: COLUMNS,
      statuses: PAYSLIP_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPayslipsPage(
          toPayslipFilters(filters, runId),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPayslipRows(toPayslipFilters(filters, runId)),
      csvFileName: 'payslips.csv',
      rowHref: (row) => payslipDetailHref(row.id),
      rowLabel: (row) =>
        `payslip ${row.periodLabel} — ${row.employeeLabel ?? 'employee'}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmPayslipEmployees(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-sent',
          label: 'Mark as sent',
          icon: Send,
          run: async (rows) => {
            const unsent = rows.filter((r) => !r.sent);
            if (unsent.length === 0) {
              return {
                ok: false,
                error: 'Every selected payslip is already sent.',
              };
            }
            for (const row of unsent) {
              const res = await markSabcrmPayslipSent(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected payslips?',
            description:
              'Only legacy manual payslips can be deleted — run-generated payslips are frozen documents. This action cannot be undone.',
            actionLabel: 'Delete payslips',
          },
          run: async (rows) => {
            const flat = rows.filter((r) => r.kind === 'flat');
            if (flat.length === 0) {
              return {
                ok: false,
                error:
                  'Run-generated payslips are frozen and cannot be deleted.',
              };
            }
            for (const row of flat) {
              const res = await deleteSabcrmPayslip(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [runId],
  );

  return (
    <>
      {runId ? (
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-4">
          <Alert tone="info" role="status">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>Showing payslips generated from one payroll run.</span>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={X}
                onClick={() => router.push(PEOPLE_PAYSLIPS_PATH)}
              >
                Show all payslips
              </Button>
            </span>
          </Alert>
        </div>
      ) : null}
      <DocListPage
        config={config}
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />
    </>
  );
}
