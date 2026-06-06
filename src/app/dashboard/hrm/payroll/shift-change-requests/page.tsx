'use client';

import React, {
  useEffect,
  useMemo,
  useState,
  useTransition,
  useRef,
  Suspense,
  use,
} from 'react';
import { Badge, Button, Card, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from '@/components/sabcrm/20ui';
import { Check, Plus, X, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { NewShiftChangeRequestForm } from './_components/new-shift-change-request-form';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getShiftChangeRequests,
  approveShiftChange,
  rejectShiftChange,
  saveShiftChangeRequest,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsEmployeeShiftChangeRequest,
  WsEmployeeShift,
  WsShiftChangeStatus,
} from '@/lib/worksuite/shifts-types';

class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Module-level promise for Suspense (client-side initial fetch)
let globalDataPromise: Promise<[WsEmployeeShiftChangeRequest[], WithId<CrmEmployee>[], WsEmployeeShift[]]> | null = null;
function getInitialData() {
  if (!globalDataPromise) {
    globalDataPromise = Promise.all([
      getShiftChangeRequests(),
      getCrmEmployees(),
      getEmployeeShifts(),
    ]);
  }
  return globalDataPromise;
}

export default function ShiftChangeRequestsPage() {
  return (
    <ErrorBoundary
      fallback={
        <EntityListShell title="Shift Change Requests" subtitle="Review and action employee requests to swap shifts.">
          <Card className="flex flex-col items-center justify-center p-12 text-[var(--st-danger)]">
            <AlertCircle className="mb-4 h-8 w-8" />
            <h2 className="text-lg font-medium">Failed to load data</h2>
            <p className="text-sm">Please try refreshing the page.</p>
          </Card>
        </EntityListShell>
      }
    >
      <Suspense
        fallback={
          <EntityListShell title="Shift Change Requests" subtitle="Review and action employee requests to swap shifts.">
            <Card className="flex h-64 items-center justify-center p-6 text-[13px] text-[var(--st-text-secondary)]">
              Loading requests...
            </Card>
          </EntityListShell>
        }
      >
        <ShiftChangeRequestsContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function ShiftChangeRequestsContent() {
  const [initialRequests, employees, shifts] = use(getInitialData());
  const [requests, setRequests] = useState<WsEmployeeShiftChangeRequest[]>(initialRequests);
  const [pending, startTransition] = useTransition();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // WebSockets simulation for collaborative editing
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime/shift-change-requests`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async (event) => {
        try {
          const newReqs = await getShiftChangeRequests();
          setRequests(newReqs);
        } catch (e) {
          console.error(e);
        }
      };
    } catch(e) {
      console.warn("WebSocket not supported or failed to connect, falling back to static data.");
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, WithId<CrmEmployee>>();
    for (const e of employees) m.set(e._id.toString(), e);
    return m;
  }, [employees]);

  const shiftMap = useMemo(() => {
    const m = new Map<string, WsEmployeeShift>();
    for (const s of shifts) if (s._id) m.set(String(s._id), s);
    return m;
  }, [shifts]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (employeeFilter !== 'all' && String(r.user_id) !== employeeFilter) return false;
      if (dateFilter.start && new Date(r.date) < new Date(dateFilter.start)) return false;
      if (dateFilter.end && new Date(r.date) > new Date(dateFilter.end)) return false;
      return true;
    });
  }, [requests, statusFilter, employeeFilter, dateFilter]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map(r => String(r._id))));
    }
  };

  const handleApprove = (id?: string) => {
    if (!id) return;
    // Optimistic UI update
    setRequests(reqs => reqs.map(r => (String(r._id) === id ? { ...r, status: 'approved' } : r)));
    toast.success('Request approved successfully');
    
    startTransition(async () => {
      try {
        await approveShiftChange(id);
        const newReqs = await getShiftChangeRequests();
        setRequests(newReqs);
      } catch (err) {
        toast.error('Failed to approve request. Reverting...');
        const oldReqs = await getShiftChangeRequests();
        setRequests(oldReqs);
      }
    });
  };

  const handleReject = (id?: string) => {
    if (!id) return;
    const reason = prompt('Reason for rejection (optional):', '') ?? '';
    // Optimistic UI update
    setRequests(reqs => reqs.map(r => (String(r._id) === id ? { ...r, status: 'rejected' } : r)));
    toast.success('Request rejected');

    startTransition(async () => {
      try {
        await rejectShiftChange(id, reason);
        const newReqs = await getShiftChangeRequests();
        setRequests(newReqs);
      } catch (err) {
        toast.error('Failed to reject request. Reverting...');
        const oldReqs = await getShiftChangeRequests();
        setRequests(oldReqs);
      }
    });
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    
    const idsToApprove = Array.from(selectedIds);
    // Optimistic UI update
    setRequests(reqs => reqs.map(r => idsToApprove.includes(String(r._id)) ? { ...r, status: 'approved' } : r));
    toast.success(`Approved ${idsToApprove.length} requests`);
    setSelectedIds(new Set());

    startTransition(async () => {
      try {
        await Promise.all(idsToApprove.map(id => approveShiftChange(id)));
        const newReqs = await getShiftChangeRequests();
        setRequests(newReqs);
      } catch (err) {
        toast.error('Bulk approval failed entirely or partially. Reverting...');
        const oldReqs = await getShiftChangeRequests();
        setRequests(oldReqs);
      }
    });
  };

  const handleExportCSV = () => {
    const data = filteredRequests.map(r => ({
      Employee: empMap.get(String(r.user_id))?.firstName ? `${empMap.get(String(r.user_id))?.firstName} ${empMap.get(String(r.user_id))?.lastName}` : String(r.user_id),
      Date: format(new Date(r.date), 'PP'),
      "Current Shift": shiftMap.get(String(r.current_shift_id))?.name || String(r.current_shift_id),
      "Requested Shift": shiftMap.get(String(r.requested_shift_id))?.name || String(r.requested_shift_id),
      Reason: r.reason || '',
      Status: r.status,
    }));
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-change-requests-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Shift Change Requests", 14, 15);
    const tableData = filteredRequests.map(r => {
      const empName = empMap.get(String(r.user_id))?.firstName ? `${empMap.get(String(r.user_id))?.firstName} ${empMap.get(String(r.user_id))?.lastName}` : String(r.user_id);
      return [
        empName,
        format(new Date(r.date), 'PP'),
        shiftMap.get(String(r.current_shift_id))?.name || String(r.current_shift_id),
        shiftMap.get(String(r.requested_shift_id))?.name || String(r.requested_shift_id),
        r.status
      ];
    });
    autoTable(doc, {
      head: [['Employee', 'Date', 'Current Shift', 'Requested Shift', 'Status']],
      body: tableData,
      startY: 20,
    });
    doc.save(`shift-change-requests-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Exported to PDF');
  };

  const handleCreateRequest = async (data: any) => {
    const res = await saveShiftChangeRequest(data);
    if (!res.success) {
      throw new Error(res.error ?? 'Failed to create request');
    }
    setDialogOpen(false);
    toast.success('Shift change request created successfully');
    const newReqs = await getShiftChangeRequests();
    setRequests(newReqs);
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65, // approximate row height
    overscan: 5,
  });

  return (
    <EntityListShell
      title="Shift Change Requests"
      subtitle="Review and action employee requests to swap shifts."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export PDF
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New Request
          </Button>
        </div>
      }
    >
      <Card className="flex flex-col overflow-hidden p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[16px] text-[var(--st-text)]">All Requests</h2>
          <div className="flex flex-wrap items-center gap-3">
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                Approve Selected ({selectedIds.size})
              </Button>
            )}
            
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(e => (
                  <SelectItem key={String(e._id)} value={String(e._id)}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Input 
              type="date"
              className="w-[130px] h-8 text-xs"
              value={dateFilter.start}
              onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              placeholder="Start Date"
            />
            <Input 
              type="date"
              className="w-[130px] h-8 text-xs"
              value={dateFilter.end}
              onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              placeholder="End Date"
            />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--st-border)] flex flex-col">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1.5fr_auto_auto] items-center gap-4 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-2.5 text-[12px] font-medium text-[var(--st-text-secondary)]">
            <div className="w-4">
              <Checkbox 
                checked={filteredRequests.length > 0 && selectedIds.size === filteredRequests.length}
                onCheckedChange={toggleAll}
              />
            </div>
            <div>Employee</div>
            <div>Date</div>
            <div>Current Shift</div>
            <div>Requested Shift</div>
            <div>Reason</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Virtualized List Body */}
          <div ref={parentRef} className="h-[500px] overflow-auto">
            {filteredRequests.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                No shift change requests found.
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const r = filteredRequests[virtualRow.index];
                  const emp = empMap.get(String(r.user_id));
                  const cur = shiftMap.get(String(r.current_shift_id));
                  const req = shiftMap.get(String(r.requested_shift_id));
                  const isSelected = selectedIds.has(String(r._id));

                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1.5fr_auto_auto] items-center gap-4 border-b border-[var(--st-border)] px-4 py-2.5 hover:bg-[var(--st-bg-muted)]/50"
                    >
                      <div className="w-4">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(String(r._id))}
                        />
                      </div>
                      <div className="truncate text-[13px] text-[var(--st-text)]">
                        {emp ? `${emp.firstName} ${emp.lastName}` : String(r.user_id)}
                      </div>
                      <div className="truncate text-[13px] text-[var(--st-text)]">
                        <ClientDate date={r.date} />
                      </div>
                      <div className="truncate">
                        <ShiftCell shift={cur} />
                      </div>
                      <div className="truncate">
                        <ShiftCell shift={req} />
                      </div>
                      <div className="truncate text-[12.5px] text-[var(--st-text-secondary)]">
                        {r.reason || '—'}
                      </div>
                      <div>
                        <Badge variant={variant(r.status)}>{r.status}</Badge>
                      </div>
                      <div className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(String(r._id))}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(String(r._id))}
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-[var(--st-text-secondary)]">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Shift Change Request</DialogTitle>
          </DialogHeader>
          <NewShiftChangeRequestForm
            employees={employees}
            shifts={shifts}
            onCancel={() => setDialogOpen(false)}
            onSubmit={handleCreateRequest}
          />
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}

function variant(s: WsShiftChangeStatus): 'warning' | 'success' | 'danger' {
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'danger';
  return 'warning';
}

function ShiftCell({ shift }: { shift?: WsEmployeeShift }) {
  if (!shift) return <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--st-text)]">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[3px] border border-[var(--st-border)] flex-shrink-0"
        style={{ backgroundColor: shift.color_code || '#EAB308' }}
      />
      <span className="truncate">{shift.name}</span>
    </span>
  );
}

function ClientDate({ date }: { date: string | Date }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="opacity-0">00/00/0000</span>;
  return <span>{format(new Date(date), 'PP')}</span>;
}
