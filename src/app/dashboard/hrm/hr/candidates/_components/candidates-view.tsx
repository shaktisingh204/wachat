'use client';

/**
 * Candidates list — §1D.1 + kanban view per spec.
 *
 * KPI (5): Total · New · In review · Offer · Hired
 * Columns (8): name+photo · job · stage · source · score · last activity · status · actions
 * Filters (6): stage, job, source, owner, score range, date range
 * Views: table | kanban (by stage)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Table as TableIcon,
  Users,
  Sparkles,
  Search as SearchIcon,
  Send,
  Trophy,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { useZoruToast, ZoruAvatar, ZoruAvatarFallback } from '@/components/zoruui';
import {
  RecruitmentListShell,
  renderStatusCell,
  type RecruitmentColumn,
  type RecruitmentFilter,
  type RecruitmentKpi,
} from '../../_components/recruitment-list-shell';
import { CandidatesKanban } from './candidates-kanban';
import { deleteCandidate } from '@/app/actions/hr.actions';

interface Candidate {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  jobId?: string;
  position?: string;
  stage?: string;
  source?: string;
  rating?: number;
  lastActivityAt?: string | Date;
  updatedAt?: string | Date;
  createdAt?: string | Date;
  applied_at?: string | Date;
  currentCompany?: string;
  experienceYears?: number;
  ownerId?: string;
}

const STAGES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
] as const;

const STAGE_OPTIONS = STAGES.map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
}));

export function CandidatesView({ initial }: { initial: Candidate[] }) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Candidate[]>(initial);
  const [view, setView] = React.useState<'table' | 'kanban'>('table');
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      stage: '',
      source: '',
      job: '',
      owner: '',
      minScore: '',
      from: '',
    },
  );
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
      const stageFilter = activeKpi || filterValues.stage;
      if (stageFilter) {
        if (stageFilter === 'inReview') {
          if (!['screening', 'interview'].includes(r.stage || '')) return false;
        } else if ((r.stage || '') !== stageFilter) {
          return false;
        }
      }
      if (filterValues.source && (r.source || '') !== filterValues.source)
        return false;
      if (filterValues.job && (r.jobId || '') !== filterValues.job)
        return false;
      if (filterValues.owner && (r.ownerId || '') !== filterValues.owner)
        return false;
      if (filterValues.minScore) {
        const min = Number(filterValues.minScore);
        if (Number.isFinite(min) && (r.rating ?? 0) < min) return false;
      }
      if (filterValues.from) {
        const from = new Date(filterValues.from);
        const d = r.applied_at || r.createdAt;
        if (!d || new Date(d) < from) return false;
      }
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const counts = React.useMemo(() => {
    const c = {
      total: rows.length,
      applied: 0,
      inReview: 0,
      offer: 0,
      hired: 0,
    };
    for (const r of rows) {
      if (r.stage === 'applied') c.applied += 1;
      if (r.stage === 'screening' || r.stage === 'interview') c.inReview += 1;
      if (r.stage === 'offer') c.offer += 1;
      if (r.stage === 'hired') c.hired += 1;
    }
    return c;
  }, [rows]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'total',
      label: 'Total',
      value: counts.total.toLocaleString(),
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: 'new',
      label: 'New',
      value: counts.applied.toLocaleString(),
      icon: <Sparkles className="h-4 w-4" />,
      filterValue: 'applied',
    },
    {
      key: 'review',
      label: 'In review',
      value: counts.inReview.toLocaleString(),
      icon: <SearchIcon className="h-4 w-4" />,
      filterValue: 'inReview',
    },
    {
      key: 'offer',
      label: 'Offer',
      value: counts.offer.toLocaleString(),
      icon: <Send className="h-4 w-4" />,
      filterValue: 'offer',
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
          <ZoruAvatar className="h-6 w-6 text-[10px]">
            <ZoruAvatarFallback>
              {(row.name || '?').slice(0, 2).toUpperCase()}
            </ZoruAvatarFallback>
          </ZoruAvatar>
          <span className="truncate font-medium">{row.name || '—'}</span>
        </Link>
      ),
    },
    {
      key: 'jobId',
      label: 'Job',
      render: (row) => (row.jobId ? <code className="text-[11px]">{shorten(row.jobId)}</code> : '—'),
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

  const filters: RecruitmentFilter[] = [
    {
      key: 'stage',
      label: 'Stage',
      type: 'select',
      options: STAGE_OPTIONS,
    },
    {
      key: 'source',
      label: 'Source',
      type: 'text',
      placeholder: 'Source',
    },
    {
      key: 'job',
      label: 'Job',
      type: 'text',
      placeholder: 'Job id',
    },
    {
      key: 'owner',
      label: 'Owner',
      type: 'text',
      placeholder: 'Owner id',
    },
    {
      key: 'minScore',
      label: 'Min score',
      type: 'text',
      placeholder: 'Min score',
    },
    {
      key: 'from',
      label: 'Applied from',
      type: 'date',
    },
  ];

  return (
    <RecruitmentListShell<Candidate>
      title="Candidates"
      subtitle="Talent pipeline — applications, stages, interviews, offers."
      basePath="/dashboard/hrm/hr/candidates"
      singular="Candidate"
      rows={filtered}
      kpis={kpis}
      activeKpi={activeKpi}
      onPickKpi={setActiveKpi}
      search={search}
      onSearchChange={onSearch}
      filters={filters}
      filterValues={filterValues}
      onFilterChange={(k, v) => {
        setFilterValues((prev) => ({ ...prev, [k]: v }));
        setPage(1);
      }}
      onClearFilters={() => {
        setFilterValues({
          stage: '',
          source: '',
          job: '',
          owner: '',
          minScore: '',
          from: '',
        });
        setActiveKpi(undefined);
        setSearch('');
        setPage(1);
      }}
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
