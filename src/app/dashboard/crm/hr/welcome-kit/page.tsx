'use client';

/**
 * HR / Welcome Kits — Deep list page (§1D template).
 *
 * KPIs (server-aggregated): total kits, pending, sent, by-phase, expiring items.
 * Filters: search · status · phase · sent-date range.
 * Bulk: mark sent · archive · delete · export CSV/XLSX.
 * Selection-aware export reuses `crm-list-export`.
 *
 * Server actions live in `hr.actions.ts` (multi-tenant via getSession in
 * hrList/hrSave). Twin paths (/crm + /hrm) revalidate together.
 */

import * as React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';

import {
  HrListShell,
  HrStatusCell,
  HrDateCell,
  type HrExportColumn,
} from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
  type DeepExportColumn,
} from '../_components/hr-deep-list-body';
import {
  bulkArchiveWelcomeKits,
  bulkDeleteWelcomeKits,
  bulkMarkWelcomeKitsSent,
  deleteWelcomeKit,
  getWelcomeKitKpis,
  getWelcomeKits,
  type HrWelcomeKitKpis,
} from '@/app/actions/hr.actions';

interface WelcomeKitRow {
  _id: string;
  name?: string;
  employee_id?: string;
  status?: string;
  sent_date?: string | Date;
  phase?: string;
  employee_phase?: string;
  items?: Array<{ label?: string; expiresAt?: string | Date }>;
  description?: string;
  notes?: string;
}

const BASE = '/dashboard/crm/hr/welcome-kit';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
];

const PHASE_OPTIONS = [
  { value: 'preboarding', label: 'Preboarding' },
  { value: 'onboarding', label: 'Onboarding' },
];

const EMPTY_KPIS: HrWelcomeKitKpis = {
  total: 0,
  pending: 0,
  sent: 0,
  expiringSoon: 0,
  byPhase: { onboarding: 0, preboarding: 0 },
};

function getRowId(r: WelcomeKitRow): string {
  return String(r._id ?? '');
}

function getRowStatus(r: WelcomeKitRow): string {
  return String(r.status ?? 'pending');
}

function rowPhase(r: WelcomeKitRow): string {
  return String(r.phase ?? r.employee_phase ?? 'onboarding');
}

function matchesSearch(r: WelcomeKitRow, q: string): boolean {
  if (!q) return true;
  const hay = `${r.name ?? ''} ${r.employee_id ?? ''} ${r.description ?? ''} ${r.notes ?? ''}`.toLowerCase();
  return hay.includes(q);
}

function inDateRange(value: unknown, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return false;
  if (from) {
    const f = new Date(from);
    if (!Number.isNaN(f.getTime()) && d < f) return false;
  }
  if (to) {
    const t = new Date(to);
    if (!Number.isNaN(t.getTime())) {
      const end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
      if (d > end) return false;
    }
  }
  return true;
}

export default function WelcomeKitPage() {
  const [rows, setRows] = React.useState<WelcomeKitRow[]>([]);
  const [kpis, setKpis] = React.useState<HrWelcomeKitKpis>(EMPTY_KPIS);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [phase, setPhase] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([
        getWelcomeKits(),
        getWelcomeKitKpis(),
      ]);
      setRows((list ?? []) as unknown as WelcomeKitRow[]);
      setKpis(k ?? EMPTY_KPIS);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (phase !== 'all' && rowPhase(r) !== phase) return false;
      if (!inDateRange(r.sent_date, dateFrom, dateTo)) return false;
      return matchesSearch(r, search.trim().toLowerCase());
    });
  }, [rows, phase, dateFrom, dateTo, search]);

  const columns: DeepColumn<WelcomeKitRow>[] = [
    {
      key: 'name',
      label: 'Kit',
      render: (r) => r.name || r.employee_id || '—',
    },
    {
      key: 'employee_id',
      label: 'Employee',
      render: (r) => r.employee_id || '—',
    },
    {
      key: 'phase',
      label: 'Phase',
      render: (r) => rowPhase(r),
    },
    {
      key: 'items',
      label: 'Items',
      numeric: true,
      render: (r) => (Array.isArray(r.items) ? r.items.length : 0),
    },
    {
      key: 'sent_date',
      label: 'Sent',
      render: (r) => <HrDateCell value={r.sent_date} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <HrStatusCell value={getRowStatus(r)} />,
    },
  ];

  const EXPORT_COLS: HrExportColumn<WelcomeKitRow>[] = [
    { label: 'Name', value: (r) => r.name ?? '' },
    { label: 'Employee', value: (r) => r.employee_id ?? '' },
    { label: 'Phase', value: (r) => rowPhase(r) },
    { label: 'Status', value: (r) => getRowStatus(r) },
    { label: 'Items', value: (r) => (Array.isArray(r.items) ? r.items.length : 0) },
    {
      label: 'Sent Date',
      value: (r) =>
        r.sent_date ? new Date(r.sent_date as string).toISOString().slice(0, 10) : '',
    },
    { label: 'Description', value: (r) => r.description ?? '' },
    { label: 'Notes', value: (r) => r.notes ?? '' },
  ];

  const exportColumns: DeepExportColumn<WelcomeKitRow>[] = [
    { header: 'Name', value: (r) => r.name ?? '' },
    { header: 'Employee', value: (r) => r.employee_id ?? '' },
    { header: 'Phase', value: (r) => rowPhase(r) },
    { header: 'Status', value: (r) => getRowStatus(r) },
    {
      header: 'Items',
      value: (r) => (Array.isArray(r.items) ? r.items.length : 0),
    },
    {
      header: 'SentDate',
      value: (r) => (r.sent_date ? new Date(r.sent_date as string).toISOString() : ''),
    },
  ];

  return (
    <HrListShell<WelcomeKitRow>
      title="Welcome Kits"
      subtitle="Curate swag, docs, and thoughtful first-day items."
      icon={Heart}
      newHref={`${BASE}/new`}
      editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
      detailHref={(r) => `${BASE}/${getRowId(r)}`}
      columns={columns}
      rows={filtered}
      loading={loading}
      getRowId={getRowId}
      getRowStatus={getRowStatus}
      statusOptions={STATUS_OPTIONS}
      searchPredicate={() => true}
      searchPlaceholder="Search by name, employee, notes…"
      kpis={[
        { label: 'Total kits', value: kpis.total.toLocaleString() },
        { label: 'Pending', value: kpis.pending.toLocaleString(), tone: 'amber' },
        { label: 'Sent', value: kpis.sent.toLocaleString(), tone: 'green' },
        {
          label: 'Expiring items',
          value: kpis.expiringSoon.toLocaleString(),
          tone: kpis.expiringSoon > 0 ? 'red' : 'neutral',
          hint: 'Within 14 days',
        },
      ]}
      exportColumns={EXPORT_COLS}
      exportBaseName="welcome-kits"
      onDelete={async (id) => {
        const res = await deleteWelcomeKit(id);
        return { success: !!res?.success, error: res?.error };
      }}
      onAfterChange={refresh}
    >
      <HrDeepListBody<WelcomeKitRow>
        rows={filtered}
        columns={columns}
        getRowId={getRowId}
        detailHref={(r) => `${BASE}/${getRowId(r)}`}
        editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
        onDeleteOne={async (id) => {
          const res = await deleteWelcomeKit(id);
          return { success: !!res?.success, error: res?.error };
        }}
        onBulkDelete={async (ids) => {
          const res = await bulkDeleteWelcomeKits(ids);
          return { success: res.success, deleted: res.deleted, error: res.error };
        }}
        onBulkArchive={async (ids) => {
          const res = await bulkArchiveWelcomeKits(ids);
          return { success: res.success, archived: res.archived, error: res.error };
        }}
        onBulkReminder={async (ids) => {
          const res = await bulkMarkWelcomeKitsSent(ids);
          return { success: res.success, notified: res.updated, error: res.error };
        }}
        reminderLabel="Mark sent"
        onAfterChange={refresh}
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search by name, employee, notes…"
        deptOptions={PHASE_OPTIONS}
        dept={phase}
        setDept={setPhase}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        exportColumns={exportColumns}
        exportName="welcome-kits"
        emptyText="No welcome kits match this filter."
        beforeTable={
          kpis.expiringSoon > 0 ? (
            <p className="text-[12px] text-zoru-ink-muted">
              <Link
                href={`${BASE}?expiring=1`}
                className="font-medium text-zoru-ink hover:underline"
              >
                {kpis.expiringSoon} kit{kpis.expiringSoon === 1 ? '' : 's'}
              </Link>{' '}
              have items expiring within 14 days.
            </p>
          ) : null
        }
      />
    </HrListShell>
  );
}
