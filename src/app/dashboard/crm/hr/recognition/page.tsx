'use client';

/**
 * Recognition — §1D Deep-list page.
 *
 * KPI strip:
 *   - Total this month
 *   - Top recipient
 *   - Top type (badge/award/peer)
 *   - Participation rate (% of distinct senders over total)
 *
 * Filters: search · type · department · sender · date range
 * Bulk:    archive · delete · export CSV / XLSX
 */

import * as React from 'react';
import Link from 'next/link';
import { Award, Plus } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill } from '@/components/crm/status-pill';

import {
  bulkArchiveRecognitions,
  bulkDeleteRecognitions,
  deleteRecognition,
  getRecognitions,
} from '@/app/actions/hr.actions';
import type { HrRecognition } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
} from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
} from '../_components/hr-deep-list-body';

type Row = HrRecognition & {
  _id: string;
  title?: string;
  department?: string;
};

const BASE = '/dashboard/crm/hr/recognition';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'kudos', label: 'Kudos' },
  { value: 'spot-award', label: 'Spot Award' },
  { value: 'performance', label: 'Performance' },
  { value: 'values', label: 'Values' },
];

function rowDate(r: Row): number | null {
  const v = r.givenAt;
  if (!v) return null;
  const t = new Date(v as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

export default function RecognitionPage(): React.JSX.Element {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [dept, setDept] = React.useState<string>('all');
  const [sender, setSender] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const data = (await getRecognitions()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── KPIs ──────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let thisMonth = 0;
    const recipientCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const senders = new Set<string>();
    for (const r of rows) {
      const t = rowDate(r);
      if (t !== null && t >= monthStart) thisMonth += 1;
      const rid = String(r.employeeId ?? '');
      if (rid) recipientCounts.set(rid, (recipientCounts.get(rid) ?? 0) + 1);
      const tp = String(r.type ?? '');
      if (tp) typeCounts.set(tp, (typeCounts.get(tp) ?? 0) + 1);
      const sid = String(r.fromName ?? '');
      if (sid) senders.add(sid);
    }
    const topRecipient =
      Array.from(recipientCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      '—';
    const topType =
      Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    const participation = rows.length
      ? Math.round((senders.size / rows.length) * 100)
      : 0;
    return { thisMonth, topRecipient, topType, participation };
  }, [rows]);

  /* ── filter options ────────────────────────────────────────────── */

  const deptOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department) set.add(r.department);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const ownerOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.fromName) set.add(r.fromName);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  /* ── filtered rows ──────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (typeFilter !== 'all' && String(r.type ?? '') !== typeFilter) return false;
      if (dept !== 'all' && (r.department ?? '') !== dept) return false;
      if (sender !== 'all' && (r.fromName ?? '') !== sender) return false;
      if (q) {
        const hay = `${r.message ?? ''} ${r.fromName ?? ''} ${r.employeeId ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = rowDate(r);
      if (from !== null && (ts == null || ts < from)) return false;
      if (to !== null && (ts == null || ts > to)) return false;
      return true;
    });
  }, [rows, search, typeFilter, dept, sender, dateFrom, dateTo]);

  const columns: DeepColumn<Row>[] = React.useMemo(
    () => [
      {
        key: 'employee',
        label: 'Recipient',
        render: (r) => String(r.employeeId ?? '—'),
      },
      {
        key: 'type',
        label: 'Type',
        render: (r) => <HrChip>{r.type}</HrChip>,
      },
      {
        key: 'points',
        label: 'Points',
        numeric: true,
        render: (r) =>
          r.points != null ? (
            <span className="tabular-nums">{r.points}</span>
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          ),
      },
      {
        key: 'message',
        label: 'Message',
        render: (r) => (
          <span className="block max-w-[260px] truncate text-zoru-ink-muted">
            {r.message ?? '—'}
          </span>
        ),
      },
      { key: 'from', label: 'From', render: (r) => r.fromName ?? '—' },
      {
        key: 'visibility',
        label: 'Visibility',
        render: (r) =>
          r.visibility ? (
            <StatusPill
              label={r.visibility}
              tone={r.visibility === 'public' ? 'green' : 'neutral'}
            />
          ) : (
            <span className="text-zoru-ink-muted">—</span>
          ),
      },
      { key: 'givenAt', label: 'Date', render: (r) => <HrDateCell value={r.givenAt} /> },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Recognition"
      subtitle="Kudos, spot awards, and peer-to-peer recognition."
      primaryAction={
        <ZoruButton asChild>
          <Link href={`${BASE}/new`}>
            <Plus className="h-4 w-4" /> Give recognition
          </Link>
        </ZoruButton>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((opt) => (
            <ZoruButton
              key={opt.value}
              variant={typeFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(opt.value)}
            >
              {opt.label}
            </ZoruButton>
          ))}
        </div>
      }
      loading={isLoading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">This month</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.thisMonth}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Top recipient</p>
            <p
              className="mt-1 truncate text-xl font-semibold text-zoru-ink"
              title={kpis.topRecipient}
            >
              {kpis.topRecipient}
            </p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Top type</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.topType}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Participation rate</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.participation}%</p>
          </ZoruCard>
        </div>

        {rows.length === 0 && !isLoading ? (
          <ZoruCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
            <Award className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
            <p className="text-sm text-zoru-ink-muted">
              No recognition yet — start celebrating wins!
            </p>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-4 w-4" /> Give first kudos
              </Link>
            </ZoruButton>
          </ZoruCard>
        ) : (
          <HrDeepListBody<Row>
            rows={filtered}
            columns={columns}
            getRowId={(r) => String(r._id)}
            detailHref={(r) => `${BASE}/${r._id}`}
            editHref={(r) => `${BASE}/${r._id}/edit`}
            onDeleteOne={deleteRecognition}
            onBulkDelete={bulkDeleteRecognitions}
            onBulkArchive={bulkArchiveRecognitions}
            onAfterChange={refresh}
            search={search}
            setSearch={setSearch}
            searchPlaceholder="Search messages / recipients…"
            deptOptions={deptOptions}
            dept={dept}
            setDept={setDept}
            ownerOptions={ownerOptions}
            owner={sender}
            setOwner={setSender}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            exportColumns={[
              { header: 'Recipient', value: (r) => String(r.employeeId ?? '') },
              { header: 'Type', value: (r) => String(r.type ?? '') },
              { header: 'Points', value: (r) => r.points ?? '' },
              { header: 'Message', value: (r) => r.message ?? '' },
              { header: 'From', value: (r) => r.fromName ?? '' },
              { header: 'Visibility', value: (r) => r.visibility ?? '' },
              {
                header: 'Date',
                value: (r) => {
                  const t = rowDate(r);
                  return t === null ? '' : new Date(t).toISOString().slice(0, 10);
                },
              },
              { header: 'Department', value: (r) => r.department ?? '' },
            ]}
            exportName="recognition"
            emptyText="No recognition matches these filters."
          />
        )}
      </div>
    </EntityListShell>
  );
}
