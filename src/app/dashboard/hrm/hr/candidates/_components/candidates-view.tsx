'use client';

import { useZoruToast, Avatar, ZoruAvatarFallback } from '@/components/zoruui';
import {
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Search as SearchIcon,
  Send,
  Trophy,
  UserCheck,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Candidates list — §1D.1 rebuild for P1.1B Wave 6.
 *
 * KPI (5) — spec-locked labels:
 *   New applications · In screening · In interview · Offered · Hired
 *
 * Columns (8):
 *   name+photo · job · stage · source · score · last activity · email · phone
 *
 * Filters per spec:
 *   • Job          — <EntityFormField entity="crmJob" />
 *   • Stage        — <EnumFilterField enumName="candidateStage" />
 *   • Source       — <EnumFilterField enumName="candidateSource" />
 *   • Min score    — text
 *   • Applied from — date
 *
 * Views: table | kanban (by stage).
 *
 * KPI counts come from the dedicated `getCandidateKpis()` server action
 * (tenant-wide, not just the visible page) so the strip never lies on
 * partial data.
 */

import * as React from 'react';
import Link from 'next/link';

import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  RecruitmentListShell,
  renderStatusCell,
  type RecruitmentColumn,
  type RecruitmentKpi,
} from '../../_components/recruitment-list-shell';
import { CandidatesKanban } from './candidates-kanban';
import { deleteCandidate } from '@/app/actions/hr.actions';
import type { CandidateKpis } from '@/app/actions/hr-recruitment-kpis.actions';

interface Candidate {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  jobId?: string;
  jobTitle?: string;
  position?: string;
  stage?: string;
  source?: string;
  rating?: number;
  lastActivityAt?: string | Date;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  applied_at?: string | Date;
  currentCompany?: string;
  ownerId?: string;
}

interface CandidatesViewProps {
  initial: Candidate[];
  kpis?: CandidateKpis;
}

export function CandidatesView({ initial, kpis }: CandidatesViewProps) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Candidate[]>(initial);
  const [view, setView] = React.useState<'table' | 'kanban'>('table');
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [stageFilter, setStageFilter] = React.useState<string>('all');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [jobFilter, setJobFilter] = React.useState<string | null>(null);
  const [minScore, setMinScore] = React.useState('');
  const [appliedFrom, setAppliedFrom] = React.useState('');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setRows(initial), [initial]);

  const onSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.name ?? ''} ${r.email ?? ''} ${r.phone ?? ''} ${
          r.currentCompany ?? ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // KPI card click sets a sentinel that maps to one of the
      // pipeline stages — `screening`, `interview`, `offer`, `hired`,
      // or the "new applications" group (stage = applied).
      const kpiStage =
        activeKpi === 'new'
          ? 'applied'
          : activeKpi === 'screening'
            ? 'screening'
            : activeKpi === 'interview'
              ? 'interview'
              : activeKpi === 'offered'
                ? 'offer'
                : activeKpi === 'hired'
                  ? 'hired'
                  : '';
      const stage =
        kpiStage || (stageFilter !== 'all' ? stageFilter : '');
      if (stage && (r.stage || '') !== stage) return false;
      if (sourceFilter !== 'all' && (r.source || '') !== sourceFilter)
        return false;
      if (jobFilter && (r.jobId || '') !== jobFilter) return false;
      if (minScore) {
        const min = Number(minScore);
        if (Number.isFinite(min) && (r.rating ?? 0) < min) return false;
      }
      if (appliedFrom) {
        const from = new Date(appliedFrom);
        const d = r.applied_at || r.createdAt;
        if (!d || new Date(d) < from) return false;
      }
      return true;
    });
  }, [
    rows,
    search,
    activeKpi,
    stageFilter,
    sourceFilter,
    jobFilter,
    minScore,
    appliedFrom,
  ]);

  // Counts come from the tenant-wide KPI action; fall back to local
  // sums when the server passes nothing (older callers / loading).
  const counts: CandidateKpis = React.useMemo(() => {
    if (kpis) return kpis;
    const out: CandidateKpis = {
      newApplications: 0,
      inScreening: 0,
      inInterview: 0,
      offered: 0,
      hired: 0,
      total: rows.length,
    };
    for (const r of rows) {
      if (r.stage === 'applied') out.newApplications += 1;
      if (r.stage === 'screening') out.inScreening += 1;
      if (r.stage === 'interview') out.inInterview += 1;
      if (r.stage === 'offer') out.offered += 1;
      if (r.stage === 'hired') out.hired += 1;
    }
    return out;
  }, [kpis, rows]);

  const kpiCards: RecruitmentKpi[] = [
    {
      key: 'new',
      label: 'New applications',
      value: counts.newApplications.toLocaleString(),
      icon: <Sparkles className="h-4 w-4" />,
      filterValue: 'new',
    },
    {
      key: 'screening',
      label: 'In screening',
      value: counts.inScreening.toLocaleString(),
      icon: <SearchIcon className="h-4 w-4" />,
      filterValue: 'screening',
    },
    {
      key: 'interview',
      label: 'In interview',
      value: counts.inInterview.toLocaleString(),
      icon: <UserCheck className="h-4 w-4" />,
      filterValue: 'interview',
    },
    {
      key: 'offered',
      label: 'Offered',
      value: counts.offered.toLocaleString(),
      icon: <Send className="h-4 w-4" />,
      filterValue: 'offered',
    },
    {
      key: 'hired',
      label: 'Hired',
      value: counts.hired.toLocaleString(),
      icon: <Trophy className="h-4 w-4" />,
      filterValue: 'hired',
    },
  ];

  const columns: RecruitmentColumn<Candidate>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link
          href={`/dashboard/hrm/hr/candidates/${row._id}`}
          className="inline-flex items-center gap-2 text-zoru-ink hover:underline"
        >
          <Avatar className="h-6 w-6 text-[10px]">
            <ZoruAvatarFallback>
              {(row.name || '?').slice(0, 2).toUpperCase()}
            </ZoruAvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{row.name || '—'}</span>
        </Link>
      ),
    },
    {
      key: 'jobId',
      label: 'Job',
      render: (row) =>
        row.jobTitle ? (
          <Link
            href={`/dashboard/hrm/hr/jobs/${row.jobId}`}
            className="text-zoru-ink hover:underline"
          >
            {row.jobTitle}
          </Link>
        ) : row.jobId ? (
          <code className="text-[11px]">{shorten(row.jobId)}</code>
        ) : (
          '—'
        ),
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (row) => renderStatusCell(row.stage),
    },
    { key: 'source', label: 'Source', render: (r) => r.source || '—' },
    {
      key: 'rating',
      label: 'Score',
      render: (r) => (r.rating != null ? `${r.rating}/5` : '—'),
    },
    {
      key: 'lastActivityAt',
      label: 'Last activity',
      render: (r) => fmtDate(r.lastActivityAt || r.updatedAt),
    },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
  ];

  // Custom filter row — uses EnumFilterField + EntityFormField per
  // §1D.1 picker uniformity. RecruitmentListShell's stock filter-row
  // is generic-text/select; we render our own and route it through
  // the same `filters` slot via a passthrough.
  const filtersSlot = (
    <>
      <div className="min-w-[180px]">
        <EnumFilterField
          enumName="candidateStage"
          value={stageFilter}
          onChange={(v) => {
            setStageFilter(v);
            setPage(1);
          }}
          allLabel="All stages"
          placeholder="Stage"
        />
      </div>
      <div className="min-w-[180px]">
        <EnumFilterField
          enumName="candidateSource"
          value={sourceFilter}
          onChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
          allLabel="All sources"
          placeholder="Source"
        />
      </div>
      <div className="min-w-[180px]">
        <EntityFormField
          entity="crmJob"
          initialId={jobFilter}
          onChange={(v) => {
            const next = typeof v === 'string' ? v : null;
            setJobFilter(next);
            setPage(1);
          }}
          placeholder="Job"
          allowCreate={false}
        />
      </div>
      <input
        type="number"
        value={minScore}
        onChange={(e) => setMinScore(e.target.value)}
        placeholder="Min score"
        className="h-8 w-[120px] rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 text-[12px] text-zoru-ink"
      />
      <input
        type="date"
        value={appliedFrom}
        onChange={(e) => setAppliedFrom(e.target.value)}
        className="h-8 w-[148px] rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 text-[12px] text-zoru-ink"
      />
    </>
  );

  const hasFilters =
    Boolean(search) ||
    stageFilter !== 'all' ||
    sourceFilter !== 'all' ||
    Boolean(jobFilter) ||
    Boolean(minScore) ||
    Boolean(appliedFrom) ||
    Boolean(activeKpi);

  return (
    <RecruitmentListShell<Candidate>
      title="Candidates"
      subtitle="Talent pipeline — applications, stages, interviews, offers."
      basePath="/dashboard/hrm/hr/candidates"
      singular="Candidate"
      rows={filtered}
      kpis={kpiCards}
      activeKpi={activeKpi}
      onPickKpi={setActiveKpi}
      search={search}
      onSearchChange={onSearch}
      filters={[]}
      filterValues={{
        // Pass-through marker so the shell's "clear all" detects state.
        __synthetic: hasFilters ? '1' : '',
      }}
      onFilterChange={() => {
        /* All filter widgets above are controlled directly. */
      }}
      onClearFilters={() => {
        setStageFilter('all');
        setSourceFilter('all');
        setJobFilter(null);
        setMinScore('');
        setAppliedFrom('');
        setActiveKpi(undefined);
        setSearch('');
        setPage(1);
      }}
      customFilters={filtersSlot}
      columns={columns}
      views={[
        { key: 'table', label: 'Table', icon: <TableIcon className="h-3.5 w-3.5" /> },
        { key: 'kanban', label: 'Kanban', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
      ]}
      activeView={view}
      onPickView={(v) => setView(v as 'table' | 'kanban')}
      customView={<CandidatesKanban candidates={filtered} />}
      onDelete={async (id) => {
        const r = await deleteCandidate(id);
        if (r.success) {
          setRows((prev) => prev.filter((c) => c._id !== id));
        } else {
          toast({
            title: 'Delete failed',
            description: r.error,
            variant: 'destructive',
          });
        }
        return r;
      }}
      onBulkDelete={async (ids) => {
        let ok = 0;
        for (const id of ids) {
          const r = await deleteCandidate(id);
          if (r.success) ok += 1;
        }
        setRows((prev) => prev.filter((c) => !ids.includes(c._id)));
        return { success: true, deleted: ok };
      }}
      page={page}
      onPageChange={setPage}
      total={filtered.length}
    />
  );
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}

function shorten(s: string) {
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
