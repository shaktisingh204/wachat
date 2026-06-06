'use client';

import { useState, useTransition, useMemo, useEffect, useRef, use, useOptimistic, useCallback } from 'react';
import { format } from 'date-fns';
import { Play, Square, Check, X, Timer, Plus, Filter, Download, Trash2, Users } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import {
  Badge, Button, Card, Input, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTimeLogs, startTimer, stopTimer, approveTimeLog, rejectTimeLog, bulkDeleteTimeLogs } from '@/app/actions/worksuite/time.actions';
import { wsFormatDuration } from '@/lib/worksuite/time-types';
import type { WsProjectTimeLog } from '@/lib/worksuite/time-types';
import { ManualEntryDialog } from './manual-entry-dialog';
import { useTimeLogsWebsocket } from './use-time-logs-websocket';
import { StartTimerCard } from './start-timer-card';
import { TimeLogsFilter } from './time-logs-filter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtDate } from '@/lib/utils';

function formatTs(ts?: string | Date | null): string {
  if (!ts) return '—';
  try {
    return format(new Date(ts), 'dd MMM yy, HH:mm');
  } catch {
    return '—';
  }
}

function elapsedLabel(startTs: string | Date): string {
  const ms = Date.now() - new Date(startTs).getTime();
  if (ms <= 0) return '0h 00m 00s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

type StatusVariant = 'warning' | 'success' | 'danger' | 'secondary' | 'info';

function statusVariant(log: WsProjectTimeLog): StatusVariant {
  if (!log.end_time) return 'warning';
  if (log.status === 'approved') return 'success';
  if (log.status === 'rejected') return 'danger';
  return 'secondary';
}

function statusLabel(log: WsProjectTimeLog): string {
  if (!log.end_time) return 'Running';
  if (log.status === 'approved') return 'Approved';
  if (log.status === 'rejected') return 'Rejected';
  return 'Pending';
}

function exportToCSV(logs: WsProjectTimeLog[]) {
  const headers = ['Employee', 'Start Time', 'End Time', 'Duration', 'Memo', 'Status'];
  const rows = logs.map(log => {
    const isRunning = !log.end_time;
    return [
      log.user_id || 'Unknown',
      log.start_time ? fmtDate(log.start_time) : '',
      isRunning ? 'Running' : (log.end_time ? fmtDate(log.end_time) : ''),
      isRunning ? 'Running' : wsFormatDuration(log.start_time, log.end_time),
      (log.memo || '').replace(/,/g, ';'),
      log.status || 'pending'
    ];
  });
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `time-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToPDF(logs: WsProjectTimeLog[]) {
  const doc = new jsPDF();
  
  const headers = [['Employee', 'Start Time', 'End Time', 'Duration', 'Memo', 'Status']];
  const rows = logs.map(log => {
    const isRunning = !log.end_time;
    return [
      log.user_id || 'Unknown',
      log.start_time ? fmtDate(log.start_time) : '',
      isRunning ? 'Running' : (log.end_time ? fmtDate(log.end_time) : ''),
      isRunning ? 'Running' : wsFormatDuration(log.start_time, log.end_time),
      log.memo || '',
      log.status || 'pending'
    ];
  });

  autoTable(doc, {
    head: headers,
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`time-logs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function TimeLogsClient({
  initialLogsPromise,
}: {
  initialLogsPromise: Promise<WsProjectTimeLog[]>;
}) {
  const { toast } = useZoruToast();

  // The actual fetched logs (resolves via Suspense on first mount)
  const serverLogs = use(initialLogsPromise);
  
  // Real-time & Optimistic setup
  const [logs, setLogs] = useState<WsProjectTimeLog[]>(serverLogs);
  const [optimisticLogs, addOptimisticLog] = useOptimistic(
    logs,
    (state: WsProjectTimeLog[], newLog: WsProjectTimeLog | { _id: string, action: 'delete' }) => {
      if ('action' in newLog && newLog.action === 'delete') {
        return state.filter(l => String(l._id) !== newLog._id);
      }
      const existing = state.findIndex(l => String(l._id) === String(newLog._id));
      if (existing > -1) {
        const next = [...state];
        next[existing] = { ...next[existing], ...newLog } as WsProjectTimeLog;
        return next;
      }
      return [newLog as WsProjectTimeLog, ...state];
    }
  );

  const [isPending, startTransition] = useTransition();

  // Selected for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, running, pending, approved, rejected

  // Start-timer memo
  const [memo, setMemo] = useState('');

  // Live elapsed ticker
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual entry dialog
  const [manualOpen, setManualOpen] = useState(false);

  // Parent ref for virtualizer
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Mount flag for hydration safe date rendering
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── Collaborative Editing / Real-time ── */
  const handleWebsocketUpdate = useCallback((newLogs: WsProjectTimeLog[]) => {
    // Only update if it's a newer set or merging logic required.
    // Assuming WS payload is the full updated list or we simply replace.
    setLogs(newLogs);
  }, []);

  useTimeLogsWebsocket(handleWebsocketUpdate);

  /* ── Reload / Filter ── */
  const load = useCallback(() => {
    startTransition(async () => {
      const filter: { from?: string; to?: string } = {};
      if (fromDate) filter.from = fromDate;
      if (toDate) filter.to = toDate;
      try {
        const data = await getTimeLogs(Object.keys(filter).length ? filter : undefined);
        setLogs(data);
        setSelectedIds(new Set()); // Reset selection on reload
      } catch (error: any) {
        toast({ title: 'Error fetching logs', description: error.message, variant: 'destructive' });
      }
    });
  }, [fromDate, toDate, toast]);

  // Client-side status filtering since server might not support it natively
  const filteredLogs = useMemo(() => {
    if (statusFilter === 'all') return optimisticLogs;
    return optimisticLogs.filter(log => {
      if (statusFilter === 'running') return !log.end_time;
      if (statusFilter === 'pending') return log.end_time && log.status !== 'approved' && log.status !== 'rejected';
      return log.status === statusFilter;
    });
  }, [optimisticLogs, statusFilter]);

  /* ── Virtualization ── */
  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52, // approx row height
    overscan: 5,
  });

  /* ── Live ticker for running entries ── */
  const hasRunning = useMemo(() => filteredLogs.some((l) => !l.end_time), [filteredLogs]);

  useEffect(() => {
    if (hasRunning) {
      tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [hasRunning]);

  /* ── Actions ── */
  const handleStartTimer = () => {
    startTransition(async () => {
      const r = await startTimer(undefined, undefined, memo.trim() || undefined);
      if (r.ok) {
        toast({ title: 'Timer started', description: 'Your timer is now running.' });
        setMemo('');
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleStopTimer = (id: string) => {
    const log = logs.find(l => String(l._id) === id);
    if (log) {
      startTransition(async () => {
        addOptimisticLog({ ...log, end_time: new Date().toISOString() } as WsProjectTimeLog);
        const r = await stopTimer(id);
        if (r.ok) {
          toast({ title: 'Timer stopped', description: 'Time entry saved.' });
          load();
        } else {
          toast({ title: 'Error', description: r.error, variant: 'destructive' });
          load(); // Revert on error
        }
      });
    }
  };

  const handleApprove = (id: string) => {
    const log = logs.find(l => String(l._id) === id);
    if (log) {
      startTransition(async () => {
        addOptimisticLog({ ...log, status: 'approved' } as WsProjectTimeLog);
        const r = await approveTimeLog(id);
        if (r.ok) {
          toast({ title: 'Approved', description: 'Time log approved.' });
        } else {
          toast({ title: 'Error', description: r.error, variant: 'destructive' });
        }
        load();
      });
    }
  };

  const handleReject = (id: string) => {
    const log = logs.find(l => String(l._id) === id);
    if (!log) return;
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (reason === null) return;
    
    startTransition(async () => {
      addOptimisticLog({ ...log, status: 'rejected' } as WsProjectTimeLog);
      const r = await rejectTimeLog(id, reason);
      if (r.ok) {
        toast({ title: 'Rejected', description: 'Time log rejected.' });
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
      load();
    });
  };

  /* ── Bulk Actions ── */
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLogs.map(l => String(l._id))));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkApprove = () => {
    startTransition(async () => {
      for (const id of selectedIds) {
        const log = logs.find(l => String(l._id) === id);
        if (log) addOptimisticLog({ ...log, status: 'approved' } as WsProjectTimeLog);
      }
      let successCount = 0;
      for (const id of selectedIds) {
        const r = await approveTimeLog(id);
        if (r.ok) successCount++;
      }
      toast({ title: 'Bulk Approved', description: `${successCount} logs approved.` });
      setSelectedIds(new Set());
      load();
    });
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} logs?`)) return;
    startTransition(async () => {
      for (const id of selectedIds) {
        addOptimisticLog({ _id: id, action: 'delete' });
      }
      const r = await bulkDeleteTimeLogs(Array.from(selectedIds));
      if (r.ok) {
        toast({ title: 'Bulk Deleted', description: `${r.count} logs deleted.` });
      } else {
        toast({ title: 'Error', description: 'Failed to delete some logs.', variant: 'destructive' });
      }
      setSelectedIds(new Set());
      load();
    });
  };

  /* ── Derived ── */
  const runningLog = useMemo(() => optimisticLogs.find((l) => !l.end_time) ?? null, [optimisticLogs]);

  const totalFormatted = useMemo(() => {
    const completedLogs = filteredLogs.filter((l) => l.end_time);
    const totalMins = completedLogs.reduce((sum, l) => sum + (l.total_hours ?? 0) * 60 + (l.total_minutes ?? 0), 0);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }, [filteredLogs]);

  return (
    <EntityListShell
      title="Time Logs"
      subtitle="Track, start, stop, and approve employee time entries."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToCSV(filteredLogs)}>
            <Download className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
            CSV
          </Button>
          <Button variant="outline" onClick={() => exportToPDF(filteredLogs)}>
            <Download className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
            PDF
          </Button>
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
            Manual Entry
          </Button>
        </div>
      }
    >
      {/* ── Active Timer Banner ── */}
      {mounted && runningLog && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2">
              <Timer className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] text-zoru-ink">Timer running</p>
              <p className="font-mono text-[12px] text-zoru-ink-muted">
                {elapsedLabel(runningLog.start_time)}
                {runningLog.memo ? ` · ${runningLog.memo}` : ''}
              </p>
            </div>
          </div>
          <Button variant="outline" disabled={isPending} onClick={() => handleStopTimer(String(runningLog._id))}>
            <Square className="h-3.5 w-3.5 fill-current text-zoru-ink" strokeWidth={1.75} />
            Stop Timer
          </Button>
        </div>
      )}

      {/* ── Start Timer Card ── */}
      {(!runningLog || !mounted) && (
        <StartTimerCard
          memo={memo}
          setMemo={setMemo}
          isPending={isPending}
          onStartTimer={handleStartTimer}
        />
      )}

      {/* ── Logs Table Card ── */}
      <Card className="p-6">
        {/* Card header + filters */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">Time Entries</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {filteredLogs.length} entr{filteredLogs.length === 1 ? 'y' : 'ies'}
              {(fromDate || toDate || statusFilter !== 'all') ? ' (filtered)' : ''}
              {filteredLogs.length > 0 ? ` · ${totalFormatted} total` : ''}
            </p>
          </div>

          <TimeLogsFilter
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            onApply={load}
            isPending={isPending}
          />
        </div>

        {/* Bulk Actions Banner */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-zoru-bg-zoru-surface-2 p-2 px-3 border border-zoru-line">
            <span className="text-sm font-medium text-zoru-ink">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkApprove} disabled={isPending}>
                <Check className="h-3.5 w-3.5 mr-1 text-zoru-ink" />
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1 text-zoru-danger-ink" />
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div ref={tableContainerRef} className="overflow-y-auto max-h-[600px] rounded-lg border border-zoru-line bg-zoru-bg shadow-sm">
          <table className="w-full caption-bottom text-sm text-zoru-ink">
            <ZoruTableHeader className="sticky top-0 z-10 bg-zoru-bg">
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 text-center">
                  <Checkbox 
                    checked={filteredLogs.length > 0 && selectedIds.size === filteredLogs.length} 
                    onCheckedChange={toggleSelectAll} 
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Start Time</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">End Time</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Duration</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Memo</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {isPending && filteredLogs.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    Loading…
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filteredLogs.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No time entries found.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const log = filteredLogs[virtualRow.index];
                  const id = String(log._id);
                  const isRunning = !log.end_time;
                  const variant = statusVariant(log);
                  const label = statusLabel(log);
                  const isPendingStatus = !!log.end_time && log.status !== 'approved' && log.status !== 'rejected';
                  const duration = !mounted ? '—' : isRunning ? elapsedLabel(log.start_time) : wsFormatDuration(log.start_time, log.end_time);

                  return (
                    <ZoruTableRow
                      key={id}
                      className={isRunning ? 'border-zoru-line bg-zoru-surface-2/10' : 'border-zoru-line'}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                    >
                      <ZoruTableCell className="w-10 text-center">
                        <Checkbox checked={selectedIds.has(id)} onCheckedChange={() => toggleSelect(id)} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                        {log.user_id || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {mounted ? formatTs(log.start_time) : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {!mounted ? '—' : isRunning ? <span className="text-zoru-ink">Running…</span> : formatTs(log.end_time)}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[13px] text-zoru-ink">
                        {duration}
                      </ZoruTableCell>
                      <ZoruTableCell className="max-w-[150px] truncate text-[11.5px] text-zoru-ink-muted">
                        {log.memo || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={variant}>{label}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isRunning && (
                            <Button variant="outline" size="sm" title="Stop Timer" disabled={isPending} onClick={() => handleStopTimer(id)}>
                              <Square className="h-3.5 w-3.5 fill-current text-zoru-ink" />
                            </Button>
                          )}
                          {isPendingStatus && (
                            <>
                              <Button variant="outline" size="sm" title="Approve" disabled={isPending} onClick={() => handleApprove(id)}>
                                <Check className="h-3.5 w-3.5 text-zoru-ink" />
                              </Button>
                              <Button variant="outline" size="sm" title="Reject" disabled={isPending} onClick={() => handleReject(id)}>
                                <X className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </Button>
                            </>
                          )}
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </table>
        </div>
      </Card>

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} onSuccess={load} />
    </EntityListShell>
  );
}
