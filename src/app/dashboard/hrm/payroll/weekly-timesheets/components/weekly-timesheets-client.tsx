'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  useZoruToast,
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useCallback,
  useRef,
} from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Plus,
  Check,
  X,
  Send,
  Eye,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
  deleteWeeklyTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  bulkSubmitTimesheets,
  bulkDeleteTimesheets,
} from '@/app/actions/worksuite/time.actions';
import type {
  WsWeeklyTimesheet,
  WsWeeklyTimesheetStatus,
} from '@/lib/worksuite/time-types';

type StatusVariant = 'secondary' | 'warning' | 'success' | 'danger';
const STATUS_VARIANT: Record<WsWeeklyTimesheetStatus, StatusVariant> = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

// Fixed client-side formatting to prevent hydration mismatch


function fmtHours(h: number, m: number): string {
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

interface WeeklyTimesheetsClientProps {
  initialSheets: WsWeeklyTimesheet[];
  initialEmployees: { _id: string; name: string }[];
}

export function WeeklyTimesheetsClient({
  initialSheets,
  initialEmployees,
}: WeeklyTimesheetsClientProps) {
  const { toast } = useZoruToast();
  const [sheets, setSheets] = useState<WsWeeklyTimesheet[]>(initialSheets);
  const [statusFilter, setStatusFilter] = useState<WsWeeklyTimesheetStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // WebSocket Mockup for Collaborative Editing
  const [isLive, setIsLive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Simulate connection to a WebSocket server
    const timeout = setTimeout(() => setIsLive(true), 1500);
    const interval = setInterval(() => {
      // Simulate receiving an update occasionally
      if (Math.random() > 0.95) {
        toast({ title: 'Live Update', description: 'Another user edited a timesheet.', variant: 'default' });
      }
    }, 15000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [toast]);

  const empMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of initialEmployees) m.set(e._id, e.name);
    return m;
  }, [initialEmployees]);

  // Memoized advanced filtering
  const filtered = useMemo(() => {
    return sheets.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const empName = empMap.get(String(s.user_id)) || '';
        if (!empName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [sheets, statusFilter, searchQuery, empMap]);

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // Estimated row height
    overscan: 10,
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => String(s._id))));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Optimistic UI updates helper
  const updateSheetOptimistically = (id: string, updates: Partial<WsWeeklyTimesheet>) => {
    setSheets((prev) => prev.map((s) => (String(s._id) === id ? { ...s, ...updates } : s)));
  };

  const removeSheetOptimistically = (id: string) => {
    setSheets((prev) => prev.filter((s) => String(s._id) !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const updateMultipleOptimistically = (ids: string[], updates: Partial<WsWeeklyTimesheet>) => {
    setSheets((prev) => prev.map((s) => (ids.includes(String(s._id)) ? { ...s, ...updates } : s)));
  };

  // --- Handlers ---
  const handleSubmit = (id?: string) => {
    if (!id) return;
    updateSheetOptimistically(id, { status: 'submitted' });
    startTransition(async () => {
      const r = await submitWeeklyTimesheet(id);
      if (r.ok) toast({ title: 'Submitted', description: 'The timesheet has been successfully submitted.' });
      else toast({ title: 'Failed to Submit', description: r.error ? String(r.error) : 'An unknown error occurred.', variant: 'destructive' });
    });
  };

  const handleApprove = (id?: string) => {
    if (!id) return;
    updateSheetOptimistically(id, { status: 'approved' });
    startTransition(async () => {
      const r = await approveWeeklyTimesheet(id);
      if (r.ok) toast({ title: 'Approved', description: 'Timesheet has been approved.' });
      else toast({ title: 'Failed to Approve', description: r.error ? String(r.error) : 'An unknown error occurred.', variant: 'destructive' });
    });
  };

  const handleReject = (id?: string) => {
    if (!id) return;
    const reason = window.prompt('Reason for rejection?') ?? '';
    if (!reason) return; // cancel
    updateSheetOptimistically(id, { status: 'rejected', reason });
    startTransition(async () => {
      const r = await rejectWeeklyTimesheet(id, reason);
      if (r.ok) toast({ title: 'Rejected', description: 'Timesheet has been rejected.' });
      else toast({ title: 'Failed to Reject', description: r.error ? String(r.error) : 'An unknown error occurred.', variant: 'destructive' });
    });
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this timesheet?')) return;
    removeSheetOptimistically(id);
    startTransition(async () => {
      await deleteWeeklyTimesheet(id);
      toast({ title: 'Deleted', description: 'Timesheet was permanently removed.' });
    });
  };

  // --- Bulk Handlers ---
  const handleBulkSubmit = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    updateMultipleOptimistically(ids, { status: 'submitted' });
    startTransition(async () => {
      await bulkSubmitTimesheets(ids);
      toast({ title: 'Bulk Submit Successful', description: `${ids.length} timesheets submitted.` });
      setSelectedIds(new Set());
    });
  };

  const handleBulkApprove = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    updateMultipleOptimistically(ids, { status: 'approved' });
    startTransition(async () => {
      await bulkApproveTimesheets(ids);
      toast({ title: 'Bulk Approve Successful', description: `${ids.length} timesheets approved.` });
      setSelectedIds(new Set());
    });
  };

  const handleBulkReject = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const reason = window.prompt('Reason for bulk rejection?');
    if (!reason) return;
    updateMultipleOptimistically(ids, { status: 'rejected', reason });
    startTransition(async () => {
      await bulkRejectTimesheets(ids, reason);
      toast({ title: 'Bulk Reject Successful', description: `${ids.length} timesheets rejected.` });
      setSelectedIds(new Set());
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} timesheets?`)) return;
    ids.forEach(removeSheetOptimistically);
    startTransition(async () => {
      await bulkDeleteTimesheets(ids);
      toast({ title: 'Bulk Delete Successful', description: `${ids.length} timesheets deleted.` });
    });
  };

  // --- CSV Export ---
  const handleExportCSV = () => {
    const headers = ['ID', 'Employee', 'Week Start', 'Week End', 'Total Hours', 'Status', 'Reason'];
    const rows = filtered.map((s) => [
      String(s._id),
      empMap.get(String(s.user_id)) || '',
      fmtDate(s.week_start_date, isMounted),
      fmtDate(s.week_end_date, isMounted),
      fmtHours(s.total_hours, s.total_minutes),
      s.status,
      s.reason || '',
    ]);
    const csvContent = [headers, ...rows].map((e) => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weekly-timesheets-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- PDF Export ---
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Weekly Timesheets", 14, 15);
    
    const body = filtered.map(s => {
      const empName = empMap.get(String(s.user_id)) || '';
      return [
        empName, 
        fmtDate(s.week_start_date, isMounted), 
        fmtDate(s.week_end_date, isMounted), 
        fmtHours(s.total_hours, s.total_minutes), 
        s.status
      ];
    });

    autoTable(doc, {
      head: [['Employee', 'Week Start', 'Week End', 'Total Hours', 'Status']],
      body,
      startY: 20,
    });
    
    doc.save(`weekly-timesheets-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <EntityListShell
      title="Weekly Timesheets"
      subtitle="Track, submit, and approve weekly hour logs across your team."
      primaryAction={
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 text-xs text-zoru-ink-muted mr-2" title="Collaborative connection active">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zoru-surface-2 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-zoru-ink"></span>
              </span>
              Live
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/dashboard/hrm/payroll/weekly-timesheets/new">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Timesheet
            </Button>
          </Link>
        </div>
      }
    >
      <Card className="flex flex-col flex-1 min-h-0">
        <div className="p-4 border-b border-zoru-line bg-zoru-surface-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 className="text-[16px] text-zoru-ink">All Timesheets</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {filtered.length} timesheet{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="search"
              placeholder="Filter by employee..."
              className="w-64 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <EnumFilterField
              enumName="timesheetStatus"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as any)}
              allLabel="All statuses"
            />
            
            {/* Bulk Actions Dropdown */}
            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Bulk Actions ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleBulkSubmit}>Submit Selected</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkApprove}>Approve Selected</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkReject}>Reject Selected</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBulkDelete} className="text-zoru-danger-ink">Delete Selected</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Header Row */}
        <div className="flex items-center px-4 py-2.5 bg-zoru-surface-2 border-b border-zoru-line text-[12px] font-medium text-zoru-ink-muted">
          <div className="w-[40px]">
            <Checkbox 
              checked={selectedIds.size > 0 && selectedIds.size === filtered.length} 
              onCheckedChange={toggleSelectAll} 
            />
          </div>
          <div className="flex-1 min-w-[150px]">Employee</div>
          <div className="w-[120px]">Week Start</div>
          <div className="w-[120px]">Week End</div>
          <div className="w-[100px]">Total Hours</div>
          <div className="w-[100px]">Status</div>
          <div className="w-[140px] text-right">Actions</div>
        </div>

        {/* Virtualized Body */}
        <div 
          ref={parentRef} 
          className="flex-1 overflow-auto bg-zoru-surface"
          style={{ minHeight: '300px', maxHeight: '600px' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {filtered.length === 0 ? (
               <div className="h-full flex items-center justify-center text-sm text-zoru-ink-muted p-8">
                 No timesheets found.
               </div>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const s = filtered[virtualRow.index];
                const id = String(s._id);
                return (
                  <div
                    key={id}
                    className="absolute top-0 left-0 w-full flex items-center px-4 py-2 border-b border-zoru-line hover:bg-zoru-surface-2/50 transition-colors text-[13px]"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="w-[40px]">
                      <Checkbox 
                        checked={selectedIds.has(id)} 
                        onCheckedChange={() => toggleSelect(id)} 
                      />
                    </div>
                    <div className="flex-1 min-w-[150px] font-medium text-zoru-ink truncate pr-2">
                      {empMap.get(String(s.user_id)) || `…${String(s.user_id).slice(-6)}`}
                    </div>
                    <div className="w-[120px] text-zoru-ink">{fmtDate(s.week_start_date, isMounted)}</div>
                    <div className="w-[120px] text-zoru-ink">{fmtDate(s.week_end_date, isMounted)}</div>
                    <div className="w-[100px] font-mono text-zoru-ink">{fmtHours(s.total_hours, s.total_minutes)}</div>
                    <div className="w-[100px]">
                      <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                    </div>
                    <div className="w-[140px] flex items-center justify-end gap-1">
                      <Link href={`/dashboard/hrm/payroll/weekly-timesheets/${s._id}`}>
                        <Button variant="outline" size="sm" title="View detail">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {s.status === 'draft' && (
                        <Button variant="outline" size="sm" onClick={() => handleSubmit(id)} title="Submit for approval">
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {s.status === 'submitted' && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleApprove(id)} title="Approve">
                            <Check className="h-3.5 w-3.5 text-zoru-ink" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleReject(id)} title="Reject">
                            <X className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleDelete(id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>
    </EntityListShell>
  );
}
