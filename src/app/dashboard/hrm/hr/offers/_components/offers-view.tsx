'use client';

import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

/**
 * Offers list — §1D.1 rebuild.
 *
 * KPI (5): Draft · Sent · Accepted · Rejected · Expired
 * Columns (9): candidate, job, designation, CTC, joining date, status,
 *   sent at, valid till, actions
 * Filters (5): status, job, candidate, joining from, CTC min
 */

import * as React from 'react';
import Link from 'next/link';

import {
  RecruitmentListShell,
  renderStatusCell,
  type RecruitmentColumn,
  type RecruitmentFilter,
  type RecruitmentKpi,
} from '../../_components/recruitment-list-shell';
import { deleteOfferLetter } from '@/app/actions/hr.actions';

interface Offer {
  _id: string;
  candidateId?: string;
  designation?: string;
  department?: string;
  salary?: number;
  ctc?: number;
  currency?: string;
  joining_date?: string | Date;
  joiningDate?: string | Date;
  valid_till?: string | Date;
  status?: string;
  sentAt?: string | Date;
  variableComponent?: number;
  fixedComponent?: number;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

export function OffersView({ initial }: { initial: Offer[] }) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Offer[]>(initial);
  const [search, setSearch] = React.useState('');
  const [activeKpi, setActiveKpi] = React.useState<string | undefined>();
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {
      status: '',
      job: '',
      candidate: '',
      joiningFrom: '',
      minCtc: '',
    },
  );
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setRows(initial), [initial]);

  const onSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const counts = React.useMemo(() => {
    const c = { draft: 0, sent: 0, accepted: 0, rejected: 0, expired: 0 };
    for (const r of rows) {
      const s = (r.status || 'pending').toLowerCase();
      if (s === 'draft' || (!r.sentAt && s === 'pending')) c.draft += 1;
      else if (s === 'pending' || s === 'sent') c.sent += 1;
      else if (s === 'accepted') c.accepted += 1;
      else if (s === 'rejected') c.rejected += 1;
      else if (s === 'expired') c.expired += 1;
    }
    return c;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.candidateId ?? ''} ${r.designation ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const statusFilter = activeKpi || filterValues.status;
      if (statusFilter) {
        if (statusFilter === 'sent') {
          if (!['sent', 'pending'].includes(r.status || 'pending'))
            return false;
        } else if ((r.status || 'pending') !== statusFilter) {
          return false;
        }
      }
      if (filterValues.candidate && (r.candidateId || '') !== filterValues.candidate)
        return false;
      if (filterValues.minCtc) {
        const min = Number(filterValues.minCtc);
        const ctc = Number(r.ctc ?? r.salary ?? 0);
        if (Number.isFinite(min) && ctc < min) return false;
      }
      if (filterValues.joiningFrom) {
        const from = new Date(filterValues.joiningFrom);
        const d = r.joining_date || r.joiningDate;
        if (!d || new Date(d) < from) return false;
      }
      return true;
    });
  }, [rows, search, filterValues, activeKpi]);

  const kpis: RecruitmentKpi[] = [
    {
      key: 'draft',
      label: 'Draft',
      value: counts.draft,
      icon: <FileText className="h-4 w-4" />,
      filterValue: 'draft',
    },
    {
      key: 'sent',
      label: 'Sent',
      value: counts.sent,
      icon: <Send className="h-4 w-4" />,
      filterValue: 'sent',
    },
    {
      key: 'accepted',
      label: 'Accepted',
      value: counts.accepted,
      icon: <CheckCircle2 className="h-4 w-4" />,
      filterValue: 'accepted',
    },
    {
      key: 'rejected',
      label: 'Rejected',
      value: counts.rejected,
      icon: <XCircle className="h-4 w-4" />,
      filterValue: 'rejected',
    },
    {
      key: 'expired',
      label: 'Expired',
      value: counts.expired,
      icon: <Clock className="h-4 w-4" />,
      filterValue: 'expired',
    },
  ];

  const columns: RecruitmentColumn<Offer>[] = [
    {
      key: 'candidateId',
      label: 'Candidate',
      render: (r) =>
        r.candidateId ? (
          <Link
            href={`/dashboard/hrm/hr/candidates/${r.candidateId}`}
            className="text-[var(--st-text)] hover:underline"
          >
            {shorten(r.candidateId)}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'designation', label: 'Designation', render: (r) => r.designation || '—' },
    { key: 'department', label: 'Department', render: (r) => r.department || '—' },
    {
      key: 'ctc',
      label: 'CTC',
      render: (r) =>
        r.ctc != null || r.salary != null
          ? `${Number(r.ctc ?? r.salary).toLocaleString()} ${r.currency || ''}`.trim()
          : '—',
    },
    {
      key: 'variableComponent',
      label: 'Variable %',
      render: (r) => {
        const ctc = Number(r.ctc ?? r.salary ?? 0);
        const v = Number(r.variableComponent ?? 0);
        return ctc > 0 ? `${Math.round((v / ctc) * 100)}%` : '—';
      },
    },
    {
      key: 'joining_date',
      label: 'Joining',
      render: (r) => fmtDate(r.joining_date || r.joiningDate),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => renderStatusCell(r.status),
    },
    { key: 'valid_till', label: 'Validity', render: (r) => fmtDate(r.valid_till) },
    { key: 'sentAt', label: 'Sent at', render: (r) => fmtDate(r.sentAt) },
  ];

  const filters: RecruitmentFilter[] = [
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'candidate', label: 'Candidate', type: 'text', placeholder: 'Candidate id' },
    { key: 'job', label: 'Job', type: 'text', placeholder: 'Job id' },
    { key: 'joiningFrom', label: 'Joining from', type: 'date' },
    { key: 'minCtc', label: 'Min CTC', type: 'text', placeholder: 'Min CTC' },
  ];

  return (
    <RecruitmentListShell<Offer>
      title="Offer Letters"
      subtitle="Draft, send, and track candidate offers."
      basePath="/dashboard/hrm/hr/offers"
      singular="Offer"
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
          status: '',
          job: '',
          candidate: '',
          joiningFrom: '',
          minCtc: '',
        });
        setActiveKpi(undefined);
        setSearch('');
        setPage(1);
      }}
      columns={columns}
      page={page}
      onPageChange={setPage}
      total={filtered.length}
      onDelete={async (id) => {
        const r = await deleteOfferLetter(id);
        if (r.success) {
          setRows((prev) => prev.filter((x) => x._id !== id));
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
        for (const id of ids) await deleteOfferLetter(id);
        setRows((prev) => prev.filter((x) => !ids.includes(x._id)));
        return { success: true };
      }}
    />
  );
}


function shorten(s: string) {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}
