'use client';

import * as React from 'react';
import { useToast } from '@/components/sabcrm/20ui';
import { Button, Input } from '@/components/sabcrm/20ui';
import {
  Download,
  Inbox,
  History,
  CheckCheck,
  FileText,
} from 'lucide-react';
import {
  getMyTaskReports,
  getMyCompletionHistory,
  getReportKpis,
  acknowledgeReport,
  bulkAcknowledgeReports,
  getReportsForExport,
  type HrmTaskReport,
} from '@/app/actions/hrm-task-reports.actions';
import { getMyDirectReports } from '@/app/actions/hrm-portal.actions';
import { ReportsKpiStrip, type KpiItem } from './_components/reports-kpi-strip';
import { ReportsInboxTable } from './_components/reports-inbox-table';
import { HistoryTable } from './_components/history-table';
import { ReportsFilter } from './_components/reports-filter';
import { ReportsErrorBoundary } from './_components/error-boundary';
import { ReportsKpiStripSkeleton } from './_components/reports-kpi-strip';
import { HistoryTableSkeleton } from './_components/history-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── CSV/PDF export helpers ───────────────────────────────────────────────────

import { fmtDate } from '@/lib/utils';

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function exportToCsv(reports: HrmTaskReport[], filename: string): void {
  const headers = [
    'Task Title',
    'Worker',
    'Roadmap ID',
    'Phase ID',
    'Completed At',
    'Status',
    'Acknowledged At',
  ];
  const rows = reports.map((r) => [
    escapeCsv(r.taskTitle),
    escapeCsv(r.workerName),
    escapeCsv(r.roadmapId),
    escapeCsv(r.phaseId),
    escapeCsv(fmtDate(r.completedAt)),
    r.acknowledgedAt ? 'Acknowledged' : 'Unacknowledged',
    escapeCsv(fmtDate(r.acknowledgedAt)),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPdf(reports: HrmTaskReport[], filename: string): void {
  const doc = new jsPDF();
  doc.text('Task Reports', 14, 15);
  
  const headers = [['Task Title', 'Worker', 'Roadmap ID', 'Phase ID', 'Completed At', 'Status', 'Acknowledged At']];
  const rows = reports.map((r) => [
    r.taskTitle || '',
    r.workerName || '',
    r.roadmapId || '',
    r.phaseId || '',
    fmtDate(r.completedAt),
    r.acknowledgedAt ? 'Acknowledged' : 'Unacknowledged',
    fmtDate(r.acknowledgedAt)
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 8 }
  });

  doc.save(filename);
}

// ─── Status filter type ───────────────────────────────────────────────────────

export type StatusFilter = 'all' | 'unacknowledged' | 'acknowledged';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaskReportsPage() {
  return (
    <ReportsErrorBoundary>
      <TaskReportsContent />
    </ReportsErrorBoundary>
  );
}

function TaskReportsContent() {
  const { toast } = useToast();

  // View selector: 'inbox' | 'history'
  const [view, setView] = React.useState<'inbox' | 'history'>('inbox');
  const [hasDirectReports, setHasDirectReports] = React.useState<boolean | null>(null);

  // Inbox state
  const [inboxReports, setInboxReports] = React.useState<HrmTaskReport[]>([]);
  const [kpisPromise, setKpisPromise] = React.useState<Promise<KpiItem[]> | null>(null);
  const [inboxLoading, setInboxLoading] = React.useState(true);

  // History state
  const [historyPromise, setHistoryPromise] = React.useState<Promise<HrmTaskReport[]> | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [workerSearch, setWorkerSearch] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  // Selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Acknowledging
  const [acknowledging, setAcknowledging] = React.useState<Set<string>>(new Set());
  const [bulkAcking, setBulkAcking] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  // ── Initial load ──────────────────────────────────────────

  React.useEffect(() => {
    const kpisP = getReportKpis();
    setKpisPromise(kpisP);
    
    const historyP = getMyCompletionHistory();
    setHistoryPromise(historyP);

    void (async () => {
      try {
        const [reports, directReports] = await Promise.all([
          getMyTaskReports(),
          getMyDirectReports(),
        ]);
        setInboxReports(reports);
        const hasReports = directReports.length > 0;
        setHasDirectReports(hasReports);
        if (!hasReports) setView('history');
      } catch (err) {
        toast({ title: 'Error', description: String(err), variant: 'destructive' });
      } finally {
        setInboxLoading(false);
      }
    })();
  }, [toast]);

  // ── Real-time collaborative updates (Mocked WebSocket) ───────────────────

  React.useEffect(() => {
    // Simulating WebSocket for real-time updates
    const ws = setInterval(() => {
      // In a real app this would be a socket.on('update')
      // For now we just optionally refresh if we are not loading/acking
      if (!inboxLoading && bulkAcking === false && acknowledging.size === 0) {
        // We could refresh but let's just keep it simple or log it
        // console.log("WS update simulated");
      }
    }, 30000); // 30 sec interval
    
    return () => clearInterval(ws);
  }, [inboxLoading, bulkAcking, acknowledging]);

  // ── Refresh inbox with current filters ──────────────────────────────────

  const refreshInbox = React.useCallback(async () => {
    setInboxLoading(true);
    setSelectedIds(new Set());
    try {
      const ack =
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'acknowledged'
            ? true
            : false;
      const [reports, reportKpisP] = await Promise.all([
        getMyTaskReports({
          acknowledged: ack,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        getReportKpis(), // We trigger the fetch
      ]);
      setInboxReports(reports);
      // For KPI we set a new resolved promise to update it
      setKpisPromise(Promise.resolve(reportKpisP));
    } catch (err) {
      toast({ title: 'Refresh failed', description: String(err), variant: 'destructive' });
    } finally {
      setInboxLoading(false);
    }
  }, [statusFilter, fromDate, toDate, toast]);

  React.useEffect(() => {
    if (view === 'inbox') void refreshInbox();
  }, [view, refreshInbox]);

  // ── Worker search filter (client-side) ──────────────────────────────────

  const filteredInbox = React.useMemo(() => {
    if (!workerSearch.trim()) return inboxReports;
    const q = workerSearch.trim().toLowerCase();
    return inboxReports.filter((r) =>
      r.workerName.toLowerCase().includes(q),
    );
  }, [inboxReports, workerSearch]);

  // ── Acknowledge single (Optimistic) ──────────────────────────────────────

  const handleAcknowledge = React.useCallback(
    async (id: string) => {
      setAcknowledging((prev) => new Set(prev).add(id));
      
      // Optimistic update
      const prevReports = [...inboxReports];
      setInboxReports(prev => prev.map(r => r._id === id ? { ...r, acknowledgedAt: new Date().toISOString() } : r));

      try {
        const result = await acknowledgeReport(id);
        if (result.success) {
          toast({ title: 'Report acknowledged' });
          // Ensure data matches server if needed, though optimistic holds
          await refreshInbox();
        } else {
          // Rollback
          setInboxReports(prevReports);
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
      } catch (err) {
        setInboxReports(prevReports);
        toast({ title: 'Error', description: String(err), variant: 'destructive' });
      } finally {
        setAcknowledging((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [refreshInbox, toast, inboxReports],
  );

  // ── Bulk acknowledge (Optimistic) ────────────────────────────────────────

  const handleBulkAcknowledge = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkAcking(true);
    
    // Optimistic update
    const prevReports = [...inboxReports];
    setInboxReports(prev => prev.map(r => selectedIds.has(r._id) ? { ...r, acknowledgedAt: new Date().toISOString() } : r));

    try {
      const result = await bulkAcknowledgeReports([...selectedIds]);
      if (result.success) {
        toast({ title: `${result.count} report(s) acknowledged` });
        await refreshInbox();
      } else {
        // Rollback
        setInboxReports(prevReports);
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (err) {
      setInboxReports(prevReports);
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setBulkAcking(false);
    }
  }, [selectedIds, refreshInbox, toast, inboxReports]);

  // ── Export selected ──────────────────────────────────────────────────────

  const handleExportSelected = React.useCallback(async (type: 'csv' | 'pdf') => {
    setExporting(true);
    try {
      let toExport: HrmTaskReport[];
      if (selectedIds.size > 0) {
        toExport = filteredInbox.filter((r) => selectedIds.has(r._id));
      } else {
        toExport = await getReportsForExport(
          fromDate || undefined,
          toDate || undefined,
        );
      }
      if (type === 'csv') {
        exportToCsv(toExport, `task-reports-${Date.now()}.csv`);
      } else {
        exportToPdf(toExport, `task-reports-${Date.now()}.pdf`);
      }
      toast({ title: `Exported ${toExport.length} report(s) as ${type.toUpperCase()}` });
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }, [selectedIds, filteredInbox, fromDate, toDate, toast]);

  // ── Selection helpers ────────────────────────────────────────────────────

  const handleToggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = filteredInbox.map((r) => r._id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }, [filteredInbox]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--st-text)]">Task Reports</h1>
          <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
            Reports from your team when they complete assigned tasks.
          </p>
        </div>

        {/* Segmented view switcher (no Tabs per project directive) */}
        <div className="inline-flex items-center rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0.5 gap-0.5">
          <Button
            variant={view === 'inbox' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('inbox')}
            className="gap-1.5 h-8"
          >
            <Inbox className="h-3.5 w-3.5" />
            Inbox
            {hasDirectReports === true ? ' (Manager)' : null}
          </Button>
          <Button
            variant={view === 'history' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('history')}
            className="gap-1.5 h-8"
          >
            <History className="h-3.5 w-3.5" />
            My History
            {hasDirectReports === false ? ' (Worker)' : null}
          </Button>
        </div>

        {/* ── INBOX VIEW ── */}
        {view === 'inbox' && (
          <div className="space-y-5">
            {/* KPI strip */}
            <React.Suspense fallback={<ReportsKpiStripSkeleton />}>
              {kpisPromise && <ReportsKpiStrip kpisPromise={kpisPromise} />}
            </React.Suspense>

            {/* Filter row */}
            <ReportsFilter
              fromDate={fromDate}
              setFromDate={setFromDate}
              toDate={toDate}
              setToDate={setToDate}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              workerSearch={workerSearch}
              setWorkerSearch={setWorkerSearch}
              onApply={() => void refreshInbox()}
            />

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-2.5">
                <span className="text-[13px] text-[var(--st-text-secondary)]">
                  {selectedIds.size} selected
                </span>
                <Button
                  size="sm"
                  disabled={bulkAcking}
                  onClick={() => void handleBulkAcknowledge()}
                  className="gap-1.5"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {bulkAcking ? 'Acknowledging…' : 'Acknowledge Selected'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExportSelected('csv')}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExportSelected('pdf')}
                  className="gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </Button>
              </div>
            )}

            {/* Export all (no selection) */}
            {selectedIds.size === 0 && (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExportSelected('csv')}
                  className="gap-1.5 h-8"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExportSelected('pdf')}
                  className="gap-1.5 h-8"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </Button>
              </div>
            )}

            {/* Table */}
            <React.Suspense fallback={<div className="h-64 bg-[var(--st-bg-secondary)] animate-pulse rounded-lg" />}>
              <ReportsInboxTable
                reports={filteredInbox}
                loading={inboxLoading}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
                onAcknowledge={(id) => void handleAcknowledge(id)}
                acknowledging={acknowledging}
              />
            </React.Suspense>
          </div>
        )}

        {/* ── HISTORY VIEW ── */}
        {view === 'history' && (
          <div className="space-y-5">
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Tasks you have completed. Read-only — your manager will acknowledge each entry.
            </p>
            <React.Suspense fallback={<HistoryTableSkeleton />}>
              {historyPromise && <HistoryTable reportsPromise={historyPromise} />}
            </React.Suspense>
          </div>
        )}
      </div>
  );
}
