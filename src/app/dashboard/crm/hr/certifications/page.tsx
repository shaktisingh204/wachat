'use client';

/**
 * HR Certifications — Deep list page (§1D.1).
 *
 * KPI strip (total awarded · expiring 30d · expired · top cert) · search ·
 * status (valid/expiring/expired) · category · date range · selection with
 * bulk delete / archive · CSV + XLSX export · pagination · `EntityRowLink`
 * for the primary cell. Multi-tenant via `getSession()` in server actions.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Award,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDateRangePicker,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  bulkHrAction,
  deleteCertification,
  getCertificationKpis,
  getCertifications,
  type HrCertificationKpis,
} from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';

const BASE = '/dashboard/crm/hr/certifications';
const COLLECTION = 'hr_certifications';
const PAGE_SIZE = 20;
const MS_30D = 30 * 24 * 60 * 60 * 1000;

type Row = HrCertification & {
  _id: string;
  employeeId: string;
  category?: string;
  doesNotExpire?: string;
  credentialUrl?: string;
  archived?: boolean;
};

type ExpiryStatus = 'valid' | 'expiring' | 'expired' | 'unknown';

const STATUS_OPTIONS: Array<{ value: ExpiryStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'valid', label: 'Valid' },
  { value: 'expiring', label: 'Expiring 30d' },
  { value: 'expired', label: 'Expired' },
  { value: 'unknown', label: 'Unknown' },
];

const EMPTY_KPIS: HrCertificationKpis = {
  totalAwarded: 0,
  expiring30: 0,
  expired: 0,
};

function classifyExpiry(row: Row, now: number): ExpiryStatus {
  if (String(row.doesNotExpire ?? '').toLowerCase() === 'yes') return 'valid';
  if (!row.expiresAt) return 'unknown';
  const exp = new Date(row.expiresAt as unknown as string).getTime();
  if (!Number.isFinite(exp)) return 'unknown';
  if (exp < now) return 'expired';
  if (exp - now <= MS_30D) return 'expiring';
  return 'valid';
}

function statusTone(s: ExpiryStatus): StatusTone {
  if (s === 'valid') return 'green';
  if (s === 'expiring') return 'amber';
  if (s === 'expired') return 'red';
  return 'neutral';
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function withinRange(value: unknown, range: DateRange | undefined): boolean {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const t = new Date(value as string).getTime();
  if (!Number.isFinite(t)) return false;
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t > range.to.getTime() + 24 * 60 * 60 * 1000 - 1) return false;
  return true;
}

export default function CertificationsListPage(): React.JSX.Element {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<HrCertificationKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ExpiryStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<
    'delete' | 'archive' | null
  >(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, k] = await Promise.all([
        getCertifications() as Promise<Row[]>,
        getCertificationKpis(),
      ]);
      setRows(Array.isArray(data) ? data : []);
      setKpis(k);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const now = Date.now();
  const categories = React.useMemo(() => {
    const out = new Set<string>();
    for (const r of rows) {
      const c = String(r.category ?? '').trim();
      if (c) out.add(c);
    }
    return Array.from(out).sort();
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.archived) return false;
      const cls = classifyExpiry(r, now);
      if (statusFilter !== 'all' && cls !== statusFilter) return false;
      if (
        categoryFilter !== 'all' &&
        String(r.category ?? '').toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        q &&
        !String(r.name ?? '').toLowerCase().includes(q) &&
        !String(r.issuer ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (!withinRange(r.issuedAt ?? r.expiresAt, dateRange)) return false;
      return true;
    });
  }, [rows, search, statusFilter, categoryFilter, dateRange, now]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const toggleAll = (check: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) for (const r of pageRows) next.add(r._id);
      else for (const r of pageRows) next.delete(r._id);
      return next;
    });
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportRows = React.useCallback(() => {
    const source =
      selected.size > 0
        ? filtered.filter((r) => selected.has(r._id))
        : filtered;
    return source.map((r) => ({
      name: r.name,
      issuer: r.issuer ?? '',
      category: r.category ?? '',
      issuedAt: fmtDate(r.issuedAt),
      expiresAt: fmtDate(r.expiresAt),
      status: classifyExpiry(r, now),
    }));
  }, [filtered, selected, now]);

  const handleCsv = (): void => {
    downloadCsv(
      `certifications-${dateStamp()}.csv`,
      ['name', 'issuer', 'category', 'issuedAt', 'expiresAt', 'status'],
      exportRows(),
    );
  };

  const handleXlsx = (): void => {
    void downloadXlsx(
      `certifications-${dateStamp()}.xlsx`,
      ['name', 'issuer', 'category', 'issuedAt', 'expiresAt', 'status'],
      exportRows(),
      'Certifications',
    );
  };

  const runBulk = (op: 'delete' | 'archive'): void => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const r = await bulkHrAction(COLLECTION, ids, op, BASE);
      if (r.success) {
        toast({
          title: `${r.affected} ${op === 'delete' ? 'deleted' : 'archived'}`,
        });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({
          title: 'Bulk action failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleSingleDelete = (): void => {
    if (!pendingDeleteId) return;
    startBulkTransition(async () => {
      const r = await deleteCertification(pendingDeleteId);
      if (r.success) {
        toast({ title: 'Certification deleted' });
        setPendingDeleteId(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDeleteId);
          return next;
        });
        await refresh();
      } else {
        toast({
          title: 'Delete failed',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };

  const resetFilters = (): void => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDateRange(undefined);
    setPage(1);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    !!dateRange?.from ||
    !!dateRange?.to;

  return (
    <>
      <EntityListShell
        title="Certifications"
        subtitle="Employee credentials, licences and renewal tracking."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleCsv}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onSelect={handleXlsx}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Download XLSX
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="h-3.5 w-3.5" /> New certification
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search certifications…',
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as ExpiryStatus | 'all');
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-[170px]">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All categories</ZoruSelectItem>
                {categories.map((c) => (
                  <ZoruSelectItem key={c} value={c}>
                    {c}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruDateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setPage(1);
              }}
              placeholder="Issued / expires range"
              className="h-9 w-[230px]"
            />
            {hasFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </ZoruButton>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleCsv}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingBulk('archive')}
                >
                  Archive
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingBulk('delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
        pagination={
          <PaginationBar
            page={page}
            limit={PAGE_SIZE}
            hasMore={filtered.length > page * PAGE_SIZE}
            total={filtered.length}
            controlled={{ onChange: ({ page: p }) => setPage(p) }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Total awarded</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.totalAwarded}
              </p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Expiring 30d</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">
                {kpis.expiring30}
              </p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Expired</p>
              <p className="mt-1 text-xl font-semibold text-zoru-ink">{kpis.expired}</p>
            </ZoruCard>
            <ZoruCard className="p-3">
              <p className="text-xs text-zoru-ink-muted">Top cert</p>
              <p
                className="mt-1 truncate text-xl font-semibold text-zoru-ink"
                title={kpis.topCert?.name}
              >
                {kpis.topCert ? kpis.topCert.name : '—'}
              </p>
              {kpis.topCert ? (
                <p className="text-[11px] text-zoru-ink-muted">
                  {kpis.topCert.count} awarded
                </p>
              ) : null}
            </ZoruCard>
          </div>

          {/* Table */}
          <ZoruCard className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)]">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <ZoruCheckbox
                        aria-label="Select all"
                        checked={allOnPageSelected}
                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Certification
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Issuer</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Issued</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Expires</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {pageRows.length === 0 ? (
                    <ZoruTableRow className="border-zoru-line">
                      <ZoruTableCell
                        colSpan={8}
                        className="h-24 text-center text-zoru-ink-muted"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Award
                            className="h-6 w-6 text-zoru-ink-muted"
                            aria-hidden="true"
                          />
                          <span>No certifications match this filter.</span>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((r) => {
                      const cls = classifyExpiry(r, now);
                      const isSelected = selected.has(r._id);
                      return (
                        <ZoruTableRow key={r._id} className="border-zoru-line">
                          <ZoruTableCell>
                            <ZoruCheckbox
                              aria-label={`Select ${r.name}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(r._id)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="font-medium text-zoru-ink">
                            <EntityRowLink
                              href={`${BASE}/${r._id}`}
                              label={r.name}
                              subtitle={r.credentialId ?? undefined}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {r.issuer ?? '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {r.category ? (
                              <ZoruBadge variant="secondary">{r.category}</ZoruBadge>
                            ) : (
                              <span className="text-zoru-ink-muted">—</span>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(r.issuedAt)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-zoru-ink">
                            {fmtDate(r.expiresAt)}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusPill
                              label={
                                cls === 'valid'
                                  ? 'Valid'
                                  : cls === 'expiring'
                                    ? 'Expiring'
                                    : cls === 'expired'
                                      ? 'Expired'
                                      : 'Unknown'
                              }
                              tone={statusTone(cls)}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <ZoruButton variant="ghost" size="sm" asChild>
                              <Link href={`${BASE}/${r._id}/edit`}>Edit</Link>
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(r._id)}
                              aria-label="Delete certification"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </ZoruButton>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })
                  )}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          </ZoruCard>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
        title="Delete certification?"
        description="This permanently removes the record."
        confirmLabel={bulkPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleSingleDelete}
      />

      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} certifications?`}
        description="This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />

      <ConfirmDialog
        open={pendingBulk === 'archive'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Archive ${selected.size} certifications?`}
        description="Archived rows are hidden from the active list but kept for audit."
        confirmTone="primary"
        confirmLabel="Archive"
        onConfirm={() => runBulk('archive')}
      />
    </>
  );
}
