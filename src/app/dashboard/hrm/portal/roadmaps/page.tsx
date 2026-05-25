'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition, useMemo, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Archive, Download, Map, Search, FileText } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  getRoadmaps,
  getRoadmapKpis,
  deleteRoadmap,
  updateRoadmap,
  type HrmRoadmap,
} from '@/app/actions/hrm-roadmaps.actions';
import { fmtDate } from '@/lib/utils';
import {
  Button,
  Badge,
  StatCard,
  Progress,
  Card,
  ZoruCardContent,
} from '@/components/zoruui';

/* ─── Error Boundary ─────────────────────────────────────────────────── */

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Roadmaps ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-500 flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200">
          <h2 className="font-semibold text-lg">Failed to load roadmaps</h2>
          <p className="text-sm mt-1">{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })} className="mt-4" variant="outline">
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<
  HrmRoadmap['status'],
  'secondary' | 'info' | 'success' | 'ghost'
> = {
  draft: 'secondary',
  active: 'info',
  completed: 'success',
  archived: 'ghost',
};

function phaseSummary(roadmap: HrmRoadmap) {
  const totalTasks = roadmap.phases?.reduce((a, p) => a + (p.tasks?.length || 0), 0) || 0;
  const doneTasks = roadmap.phases?.reduce(
    (a, p) => a + (p.tasks?.filter((t) => t.status === 'done').length || 0),
    0,
  ) || 0;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  return { phaseCount: roadmap.phases?.length || 0, totalTasks, doneTasks, pct };
}

function exportCsv(rows: HrmRoadmap[]) {
  const headers = ['Title', 'Status', 'Phases', 'Total Tasks', 'Done', 'Progress %'];
  const lines = rows.map((r) => {
    const { phaseCount, totalTasks, doneTasks, pct } = phaseSummary(r);
    return [`"${r.title.replace(/"/g, '""')}"`, r.status, phaseCount, totalTasks, doneTasks, pct].join(',');
  });
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'roadmaps.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(rows: HrmRoadmap[]) {
  const doc = new jsPDF();
  doc.text('Roadmaps Report', 14, 15);
  autoTable(doc, {
    startY: 20,
    head: [['Title', 'Status', 'Phases', 'Total Tasks', 'Done', 'Progress %']],
    body: rows.map((r) => {
      const { phaseCount, totalTasks, doneTasks, pct } = phaseSummary(r);
      return [r.title, r.status, phaseCount, totalTasks, doneTasks, `${pct}%`];
    }),
  });
  doc.save('roadmaps.pdf');
}

/* ─── Components ─────────────────────────────────────────────────────── */

function ClientDate({ dateString }: { dateString?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !dateString) return <span className="opacity-0">00/00/0000</span>;
  return <span>{fmtDate(dateString)}</span>;
}

function FilterBar({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
      <div className="relative flex-1 w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoru-ink-muted" />
        <input
          type="text"
          placeholder="Search roadmaps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-zoru-line rounded-[var(--zoru-radius)] bg-zoru-surface focus:outline-none focus:ring-2 focus:ring-zoru-primary transition-all"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-zoru-line rounded-[var(--zoru-radius)] bg-zoru-surface focus:outline-none focus:ring-2 focus:ring-zoru-primary w-full sm:w-auto transition-all"
      >
        <option value="all">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="archived">Archived</option>
      </select>
    </div>
  );
}

function BulkActionsBar({
  selectedCount,
  onArchive,
  onDelete,
  onExportCsv,
  onExportPdf,
}: {
  selectedCount: number;
  onArchive: () => void;
  onDelete: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-4 py-2 animate-in fade-in slide-in-from-top-2">
      <span className="text-sm font-medium text-zoru-ink-muted">{selectedCount} selected</span>
      <div className="h-4 w-[1px] bg-zoru-line mx-2 hidden sm:block" />
      <Button variant="ghost" size="sm" onClick={onArchive}>
        <Archive className="w-4 h-4 mr-2" />
        Archive
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </Button>
      <div className="flex-1 min-w-[10px]" />
      <Button variant="outline" size="sm" onClick={onExportCsv}>
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPdf}>
        <FileText className="w-4 h-4 mr-2" />
        PDF
      </Button>
    </div>
  );
}

/* ─── Main Client View ───────────────────────────────────────────────── */

function RoadmapsClient() {
  const router = useRouter();
  const [rows, setRows] = useState<HrmRoadmap[]>([]);
  const [kpis, setKpis] = useState<{ label: string; value: number }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, startTransition] = useTransition();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const [data, kpiData] = await Promise.all([getRoadmaps(), getRoadmapKpis()]);
        setRows(data || []);
        setKpis(kpiData || []);
      } catch (err) {
        toast.error('Failed to fetch roadmaps');
      } finally {
        setIsInitialLoad(false);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Simulated WebSockets for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([getRoadmaps(), getRoadmapKpis()])
        .then(([data, kpiData]) => {
          setRows(data || []);
          setKpis(kpiData || []);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredRows.length && filteredRows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map((r) => r._id)));
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    const selectedIds = new Set(selected);
    const prevRows = [...rows];
    
    // Optimistic
    setRows(prevRows.filter((r) => !selectedIds.has(r._id)));
    setSelected(new Set());
    
    startTransition(async () => {
      try {
        await Promise.all([...selectedIds].map((id) => deleteRoadmap(id)));
        toast.success(`Deleted ${selectedIds.size} roadmaps`);
        refresh();
      } catch (err) {
        toast.error('Failed to delete some roadmaps');
        setRows(prevRows); // Revert
      }
    });
  }

  async function handleBulkArchive() {
    if (!selected.size) return;
    const selectedIds = new Set(selected);
    const prevRows = [...rows];
    
    // Optimistic
    setRows(prevRows.map(r => selectedIds.has(r._id) ? { ...r, status: 'archived' } : r));
    setSelected(new Set());

    startTransition(async () => {
      try {
        await Promise.all(
          [...selectedIds].map((id) => updateRoadmap(id, { status: 'archived' })),
        );
        toast.success(`Archived ${selectedIds.size} roadmaps`);
        refresh();
      } catch (err) {
        toast.error('Failed to archive some roadmaps');
        setRows(prevRows); // Revert
      }
    });
  }

  const VirtualizedRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = filteredRows[index];
    if (!row) return null;
    const { phaseCount, totalTasks, doneTasks, pct } = phaseSummary(row);
    
    return (
      <div
        style={style}
        className="flex items-center border-b border-zoru-line/60 transition-colors hover:bg-zoru-surface px-4 text-sm"
      >
        <div className="w-8 shrink-0">
          <input
            type="checkbox"
            checked={selected.has(row._id)}
            onChange={() => toggleSelect(row._id)}
            className="accent-zoru-primary"
          />
        </div>
        <div className="flex-1 min-w-[150px] truncate pr-2">
          <button
            className="font-medium text-zoru-ink hover:text-zoru-primary hover:underline text-left truncate w-full"
            onClick={() => router.push(`/dashboard/hrm/portal/roadmaps/${row._id}`)}
          >
            {row.title}
          </button>
        </div>
        <div className="w-[100px] shrink-0">
          <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
        </div>
        <div className="w-[80px] shrink-0 tabular-nums text-zoru-ink-muted">
          {phaseCount}
        </div>
        <div className="w-[80px] shrink-0 tabular-nums text-zoru-ink-muted">
          {totalTasks}
        </div>
        <div className="w-[80px] shrink-0 tabular-nums text-zoru-ink-muted">
          {doneTasks}
        </div>
        <div className="w-[100px] shrink-0 text-zoru-ink-muted text-xs">
          <ClientDate dateString={row.createdAt} />
        </div>
        <div className="w-[120px] shrink-0 flex items-center gap-2 pr-2">
          <Progress value={pct || 0} className="flex-1" />
          <span className="w-8 text-right text-xs tabular-nums text-zoru-ink-muted">{pct}%</span>
        </div>
        <div className="w-[80px] shrink-0 flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/hrm/portal/roadmaps/${row._id}`)}>
            <Map className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              const prevRows = [...rows];
              // Optimistic delete single
              setRows(rows.filter(r => r._id !== row._id));
              startTransition(async () => {
                try {
                  await deleteRoadmap(row._id);
                  toast.success('Roadmap deleted');
                  refresh();
                } catch {
                  toast.error('Failed to delete roadmap');
                  setRows(prevRows);
                }
              });
            }}
          >
            <Trash2 className="w-4 h-4 text-zoru-danger" />
          </Button>
        </div>
      </div>
    );
  }, [filteredRows, selected, rows, router, refresh]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zoru-ink">Roadmaps</h1>
          <p className="text-sm text-zoru-ink-muted">Plan and track team initiatives phase by phase.</p>
        </div>
        <Button size="md" onClick={() => router.push('/dashboard/hrm/portal/roadmaps/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Roadmap
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={<Map className="w-5 h-5 opacity-80" />} />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <FilterBar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <BulkActionsBar 
          selectedCount={selected.size}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDelete}
          onExportCsv={() => exportCsv(rows.filter((r) => selected.has(r._id)))}
          onExportPdf={() => exportPdf(rows.filter((r) => selected.has(r._id)))}
        />
      )}

      {/* Table Area */}
      <Card>
        <ZoruCardContent className="p-0">
          {isInitialLoad ? (
            <div className="flex h-48 items-center justify-center text-sm text-zoru-ink-muted animate-pulse">
              Loading roadmaps...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-zoru-ink-muted">
              <Map className="h-8 w-8 opacity-40" />
              <span>{rows.length === 0 ? 'No roadmaps yet. Create your first one.' : 'No roadmaps match your filters.'}</span>
              {rows.length === 0 && (
                <Button size="sm" onClick={() => router.push('/dashboard/hrm/portal/roadmaps/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Roadmap
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <div className="min-w-[900px]">
                {/* Header Row */}
                <div className="flex items-center text-left text-xs uppercase tracking-wide text-zoru-ink-subtle px-4 py-3 border-b border-zoru-line">
                  <div className="w-8 shrink-0">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredRows.length && filteredRows.length > 0}
                      onChange={toggleAll}
                      className="accent-zoru-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">Title</div>
                  <div className="w-[100px] shrink-0">Status</div>
                  <div className="w-[80px] shrink-0">Phases</div>
                  <div className="w-[80px] shrink-0">Total Tasks</div>
                  <div className="w-[80px] shrink-0">Done</div>
                  <div className="w-[100px] shrink-0">Created</div>
                  <div className="w-[120px] shrink-0">Progress</div>
                  <div className="w-[80px] shrink-0 text-right pr-2">Actions</div>
                </div>

                {/* List Body */}
                {filteredRows.length > 50 ? (
                  <List
                    height={600}
                    itemCount={filteredRows.length}
                    itemSize={60}
                    width="100%"
                  >
                    {VirtualizedRow}
                  </List>
                ) : (
                  <div>
                    {filteredRows.map((_, i) => (
                      <VirtualizedRow key={filteredRows[i]._id} index={i} style={{ height: 60 }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function RoadmapsPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-6">Loading roadmap dashboard...</div>}>
        <RoadmapsClient />
      </Suspense>
    </ErrorBoundary>
  );
}
