'use client';

/**
 * HRM Portal — Task Reports page.
 *
 * Two views:
 *  1. "Inbox" (manager) — reports where I am the assigner.
 *     KPI strip, filter row (date range + status chips + worker search),
 *     checkable table, bulk acknowledge, CSV export.
 *
 *  2. "My History" (worker) — tasks I completed.
 *     Read-only table with manager-acknowledged indicator.
 *
 * The active view is chosen by a segmented button strip at the top.
 * If the user has direct reports their Inbox is shown first; otherwise
 * their completion history is shown first.
 */

import * as React from 'react';
import {
  Button,
  Input,
  useZoruToast,
} from '@/components/zoruui';
import {
  Download,
  Inbox,
  History,
  CheckCheck,
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

// ─── CSV export helper ────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

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

// ─── Status filter type ───────────────────────────────────────────────────────

type StatusFilter = 'all' | 'unacknowledged' | 'acknowledged';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TaskReportsPage() {
  const { toast } = useZoruToast();

  // View selector: 'inbox' | 'history'
  const [view, setView] = React.useState<'inbox' | 'history'>('inbox');
  const [hasDirectReports, setHasDirectReports] = React.useState<boolean | null>(null);

  // Inbox state
  const [inboxReports, setInboxReports] = React.useState<HrmTaskReport[]>([]);
  const [kpis, setKpis] = React.useState<KpiItem[]>([]);
  const [inboxLoading, setInboxLoading] = React.useState(true);
  const [kpisLoading, setKpisLoading] = React.useState(true);

  // History state
  const [historyReports, setHistoryReports] = React.useState<HrmTaskReport[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

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

  // ── Initial load ─────────────────────────────────────────────────────────

  React.useEffect(() => {
    void (async () => {
      const [reports, reportKpis, directReports] = await Promise.all([
        getMyTaskReports(),
        getReportKpis(),
        getMyDirectReports(),
      ]);
      setInboxReports(reports);
      setKpis(reportKpis);
      setInboxLoading(false);
      setKpisLoading(false);
      const hasReports = directReports.length > 0;
      setHasDirectReports(hasReports);
      // Default to history view if user has no direct reports
      if (!hasReports) setView('history');
    })();

    void (async () => {
      const history = await getMyCompletionHistory();
      setHistoryReports(history);
      setHistoryLoading(false);
    })();
  }, []);

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
      const [reports, reportKpis] = await Promise.all([
        getMyTaskReports({
          acknowledged: ack,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        getReportKpis(),
      ]);
      setInboxReports(reports);
      setKpis(reportKpis);
    } finally {
      setInboxLoading(false);
    }
  }, [statusFilter, fromDate, toDate]);

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

  // ── Acknowledge single ───────────────────────────────────────────────────

  const handleAcknowledge = React.useCallback(
    async (id: string) => {
      setAcknowledging((prev) => new Set(prev).add(id));
      try {
        const result = await acknowledgeReport(id);
        if (result.success) {
          toast({ title: 'Report acknowledged' });
          await refreshInbox();
        } else {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
      } finally {
        setAcknowledging((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [refreshInbox, toast],
  );

  // ── Bulk acknowledge ─────────────────────────────────────────────────────

  const handleBulkAcknowledge = React.useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkAcking(true);
    try {
      const result = await bulkAcknowledgeReports([...selectedIds]);
      if (result.success) {
        toast({ title: `${result.count} report(s) acknowledged` });
        await refreshInbox();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } finally {
      setBulkAcking(false);
    }
  }, [selectedIds, refreshInbox, toast]);

  // ── Export selected ──────────────────────────────────────────────────────

  const handleExportSelected = React.useCallback(async () => {
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
      exportToCsv(toExport, `task-reports-${Date.now()}.csv`);
      toast({ title: `Exported ${toExport.length} report(s)` });
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
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }, [filteredInbox]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-semibold text-zoru-ink">Task Reports</h1>
        <p className="mt-1 text-[13px] text-zoru-ink-muted">
          Reports from your team when they complete assigned tasks.
        </p>
      </div>

      {/* Segmented view switcher (no Tabs per project directive) */}
      <div className="inline-flex items-center rounded-lg border border-zoru-line bg-zoru-surface p-0.5 gap-0.5">
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
          <ReportsKpiStrip kpis={kpis} loading={kpisLoading} />

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-zoru-ink-muted whitespace-nowrap">From</label>
              <Input
                type="date"
                className="h-8 text-[13px] w-36"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <label className="text-[12px] text-zoru-ink-muted whitespace-nowrap">To</label>
              <Input
                type="date"
                className="h-8 text-[13px] w-36"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-1">
              {(['all', 'unacknowledged', 'acknowledged'] as StatusFilter[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                  className="h-8 capitalize"
                >
                  {s === 'all' ? 'All' : s === 'unacknowledged' ? 'Unacknowledged' : 'Acknowledged'}
                </Button>
              ))}
            </div>

            {/* Worker search */}
            <Input
              placeholder="Search by worker…"
              className="h-8 text-[13px] w-48"
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
            />

            {/* Apply filters */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshInbox()}
              className="h-8"
            >
              Apply
            </Button>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2.5">
              <span className="text-[13px] text-zoru-ink-muted">
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
                onClick={() => void handleExportSelected()}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? 'Exporting…' : 'Export Selected'}
              </Button>
            </div>
          )}

          {/* Export all (no selection) */}
          {selectedIds.size === 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => void handleExportSelected()}
                className="gap-1.5 h-8"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          )}

          {/* Table */}
          <ReportsInboxTable
            reports={filteredInbox}
            loading={inboxLoading}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleAll={handleToggleAll}
            onAcknowledge={(id) => void handleAcknowledge(id)}
            acknowledging={acknowledging}
          />
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="space-y-5">
          <p className="text-[13px] text-zoru-ink-muted">
            Tasks you have completed. Read-only — your manager will acknowledge each entry.
          </p>
          <HistoryTable reports={historyReports} loading={historyLoading} />
        </div>
      )}
    </div>
  );
}
