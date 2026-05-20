'use client';

/**
 * Surveys — §1D Deep-list page.
 *
 * KPI strip:
 *   - Total surveys
 *   - Active
 *   - Completion rate (avg responses / target across targeted surveys)
 *   - Top NPS (highest avg NPS score across surveys)
 *
 * Filters: search · status · type (cycle) · department · owner · date range
 * Bulk:    archive · delete · send-reminder · export CSV / XLSX
 */

import * as React from 'react';
import Link from 'next/link';
import { Gauge, Plus } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
  bulkArchiveSurveys,
  bulkDeleteSurveys,
  bulkRemindSurveys,
  deleteSurvey,
  getSurveys,
} from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';

import {
  HrChip,
  HrDateCell,
  HrStatusCell,
} from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
} from '../_components/hr-deep-list-body';

type Row = HrSurvey & {
  _id: string;
  type?: string;
  target?: string;
  anonymous?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  deadline?: string | Date;
  targetCount?: number;
  department?: string;
  ownerId?: string;
  ownerName?: string;
  npsScore?: number;
};

const BASE = '/dashboard/crm/hr/surveys';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

function rowDate(r: Row): number | null {
  const v = r.deadline ?? r.endDate ?? r.updatedAt ?? r.createdAt;
  if (!v) return null;
  const t = new Date(v as string | Date).getTime();
  return Number.isFinite(t) ? t : null;
}

export default function SurveysPage(): React.JSX.Element {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [typeF, setTypeF] = React.useState<string>('all');
  const [dept, setDept] = React.useState<string>('all');
  const [owner, setOwner] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const data = (await getSurveys()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── KPIs ──────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'active' || s === 'open';
    }).length;
    let rateSum = 0;
    let rateN = 0;
    let topNps = -Infinity;
    for (const r of rows) {
      const got = Number(r.responsesCount) || 0;
      const target = Number(r.targetCount) || 0;
      if (target > 0) {
        rateSum += got / target;
        rateN += 1;
      }
      const nps = Number(r.npsScore);
      if (Number.isFinite(nps) && nps > topNps) topNps = nps;
    }
    const completion = rateN ? Math.round((rateSum / rateN) * 100) : 0;
    return {
      total,
      active,
      completion,
      topNps: topNps === -Infinity ? null : Math.round(topNps),
    };
  }, [rows]);

  /* ── filter options ────────────────────────────────────────────── */

  const cycleOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.type) set.add(r.type);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const deptOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department) set.add(r.department);
    return Array.from(set).sort().map((v) => ({ value: v, label: v }));
  }, [rows]);

  const ownerOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const id = String(r.ownerId ?? r.ownerName ?? '');
      if (id && !seen.has(id)) seen.set(id, r.ownerName ?? id);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  /* ── filtered rows ──────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (statusFilter !== 'all' && String(r.status ?? '').toLowerCase() !== statusFilter)
        return false;
      if (typeF !== 'all' && (r.type ?? '') !== typeF) return false;
      if (dept !== 'all' && (r.department ?? '') !== dept) return false;
      if (owner !== 'all') {
        const id = String(r.ownerId ?? r.ownerName ?? '');
        if (id !== owner) return false;
      }
      if (q) {
        const hay = `${r.title ?? ''} ${r.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = rowDate(r);
      if (from !== null && (ts == null || ts < from)) return false;
      if (to !== null && (ts == null || ts > to)) return false;
      return true;
    });
  }, [rows, search, statusFilter, typeF, dept, owner, dateFrom, dateTo]);

  const columns: DeepColumn<Row>[] = React.useMemo(
    () => [
      {
        key: 'title',
        label: 'Title',
        render: (r) => (
          <span className="block max-w-[260px] truncate font-medium">{r.title}</span>
        ),
      },
      {
        key: 'type',
        label: 'Type',
        render: (r) =>
          r.type ? <HrChip>{r.type}</HrChip> : <span className="text-zoru-ink-muted">—</span>,
      },
      {
        key: 'audience',
        label: 'Audience',
        render: (r) =>
          r.target ? <HrChip>{r.target}</HrChip> : <span className="text-zoru-ink-muted">—</span>,
      },
      {
        key: 'questions',
        label: 'Qs',
        numeric: true,
        render: (r) => (
          <span className="tabular-nums">
            {Array.isArray(r.questions) ? r.questions.length : 0}
          </span>
        ),
      },
      {
        key: 'responses',
        label: 'Responses',
        render: (r) => {
          const got = Number(r.responsesCount) || 0;
          const target = Number(r.targetCount) || 0;
          const pct = target ? Math.round((got / target) * 100) : null;
          return (
            <span className="tabular-nums text-zoru-ink">
              {got}
              {target ? <span className="text-zoru-ink-muted"> / {target}</span> : null}
              {pct !== null ? (
                <span className="ml-1 text-[11px] text-zoru-ink-muted">({pct}%)</span>
              ) : null}
            </span>
          );
        },
      },
      {
        key: 'deadline',
        label: 'Deadline',
        render: (r) => <HrDateCell value={r.deadline ?? r.endDate} />,
      },
      {
        key: 'status',
        label: 'Status',
        render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
      },
    ],
    [],
  );

  return (
    <EntityListShell
      title="Surveys"
      subtitle="Pulse, engagement, exit, and onboarding surveys."
      primaryAction={
        <ZoruButton asChild>
          <Link href={`${BASE}/new`}>
            <Plus className="h-4 w-4" /> New survey
          </Link>
        </ZoruButton>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((opt) => (
            <ZoruButton
              key={opt.value}
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
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
            <p className="text-xs text-zoru-ink-muted">Total surveys</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.total}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Active</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.active}</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Completion rate</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.completion}%</p>
          </ZoruCard>
          <ZoruCard className="p-3">
            <p className="text-xs text-zoru-ink-muted">Top NPS</p>
            <p className="mt-1 text-xl font-semibold text-zoru-ink">
              {kpis.topNps === null ? '—' : kpis.topNps}
            </p>
          </ZoruCard>
        </div>

        {rows.length === 0 && !isLoading ? (
          <ZoruCard className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6">
            <Gauge className="h-8 w-8 text-zoru-ink-muted" aria-hidden="true" />
            <p className="text-sm text-zoru-ink-muted">No surveys yet.</p>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-4 w-4" /> Create first survey
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
            onDeleteOne={deleteSurvey}
            onBulkDelete={bulkDeleteSurveys}
            onBulkArchive={bulkArchiveSurveys}
            onBulkReminder={bulkRemindSurveys}
            reminderLabel="Remind respondents"
            onAfterChange={refresh}
            search={search}
            setSearch={setSearch}
            searchPlaceholder="Search surveys…"
            cycleOptions={cycleOptions}
            cycle={typeF}
            setCycle={setTypeF}
            cycleLabel="Type"
            deptOptions={deptOptions}
            dept={dept}
            setDept={setDept}
            ownerOptions={ownerOptions}
            owner={owner}
            setOwner={setOwner}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            exportColumns={[
              { header: 'Title', value: (r) => r.title ?? '' },
              { header: 'Type', value: (r) => r.type ?? '' },
              { header: 'Audience', value: (r) => r.target ?? '' },
              {
                header: 'Questions',
                value: (r) => (Array.isArray(r.questions) ? r.questions.length : 0),
              },
              { header: 'Responses', value: (r) => Number(r.responsesCount) || 0 },
              { header: 'Target', value: (r) => Number(r.targetCount) || 0 },
              {
                header: 'Response rate %',
                value: (r) => {
                  const got = Number(r.responsesCount) || 0;
                  const target = Number(r.targetCount) || 0;
                  return target ? Math.round((got / target) * 100) : '';
                },
              },
              {
                header: 'Deadline',
                value: (r) => {
                  const v = r.deadline ?? r.endDate;
                  if (!v) return '';
                  const t = new Date(v as string | Date).getTime();
                  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
                },
              },
              { header: 'Status', value: (r) => String(r.status ?? '') },
              { header: 'NPS', value: (r) => Number(r.npsScore) || '' },
              { header: 'Department', value: (r) => r.department ?? '' },
            ]}
            exportName="surveys"
            emptyText="No surveys match these filters."
          />
        )}
      </div>
    </EntityListShell>
  );
}
