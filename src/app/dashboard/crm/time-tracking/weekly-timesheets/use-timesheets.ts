import * as React from 'react';
import { useZoruToast } from '@/components/zoruui';
import {
  getWeeklyTimesheetsPaginated,
  deleteWeeklyTimesheet,
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
  bulkSubmitTimesheets,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  bulkDeleteTimesheets,
} from '@/app/actions/worksuite/time.actions';
import type { WsWeeklyTimesheet } from '@/lib/worksuite/time-types';
import { useDebouncedCallback } from 'use-debounce';

export type Row = WsWeeklyTimesheet & { _id: string };

export function useTimesheets() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState<string>('');
  const [toDate, setToDate] = React.useState<string>('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Row | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = React.useTransition();
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const LIMIT = 10;

  const fetchTimesheets = React.useCallback((currentPage: number, append: boolean = false) => {
    startLoading(async () => {
      try {
        const res = await getWeeklyTimesheetsPaginated(currentPage, LIMIT, {
          user_id: employeeFilter,
          status: statusFilter,
          fromDate,
          toDate,
          search
        });
        
        if (append) {
          setRows((prev) => [...prev, ...(res.items as unknown as Row[])]);
        } else {
          setRows(res.items as unknown as Row[]);
        }
        setTotal(res.total);
        setHasMore(currentPage * LIMIT < res.total);
      } catch (e) {
        toast({
          title: 'Failed to load timesheets',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      } finally {
        setInitialLoading(false);
      }
    });
  }, [employeeFilter, statusFilter, fromDate, toDate, search, toast]);

  const refresh = React.useCallback(() => {
    setPage(1);
    fetchTimesheets(1, false);
  }, [fetchTimesheets]);

  React.useEffect(() => {
    setInitialLoading(true);
    refresh();
  }, [refresh]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTimesheets(nextPage, true);
  };

  const handleSearch = useDebouncedCallback((v: string) => setSearch(v), 300);

  // KPIs need all rows for accuracy or just based on fetched rows?
  // Since we have server pagination, KPIs on fetched rows might be incomplete, but let's keep the existing logic.
  const kpis = React.useMemo(() => {
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    const pending = rows.filter((r) => r.status === 'submitted' || r.status === 'draft').length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const uniqueEmps = new Set(rows.map((r) => String(r.user_id))).size || 1;
    const totalH = rows.reduce(
      (s, r) => s + ((Number(r.total_hours) || 0) + (Number(r.total_minutes) || 0) / 60),
      0,
    );
    const avg = uniqueEmps > 0 ? Math.round((totalH / uniqueEmps) * 10) / 10 : 0;
    return { submitted, pending, approved, avg };
  }, [rows]);

  const hasActiveFilters = statusFilter !== 'all' || !!employeeFilter || !!fromDate || !!toDate;
  const clearFilters = () => {
    setStatusFilter('all');
    setEmployeeFilter('');
    setFromDate('');
    setToDate('');
  };

  const deleteRow = React.useMemo(() => rows.find((r) => r._id === deleteId) ?? null, [rows, deleteId]);

  const filteredIds = React.useMemo(() => rows.map((r) => r._id), [rows]);
  const allChecked = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someChecked = filteredIds.some((id) => selected.has(id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = React.useMemo(() => [...selected].filter((id) => filteredIds.includes(id)), [selected, filteredIds]);
  const hasSelection = selectedIds.length > 0;

  // Single Actions
  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteId) return;
    const res = await deleteWeeklyTimesheet(deleteId);
    if (res?.success) {
      toast({ title: 'Timesheet deleted' });
      refresh();
    } else {
      toast({ title: 'Delete failed', description: res?.error ?? 'Unknown error', variant: 'destructive' });
    }
    setDeleteId(null);
  }, [deleteId, refresh, toast]);

  const handleSubmit = React.useCallback(async (id: string) => {
    const res = await submitWeeklyTimesheet(id);
    if (res.ok) { toast({ title: 'Timesheet submitted' }); refresh(); }
    else { toast({ title: 'Error', description: res.error, variant: 'destructive' }); }
  }, [refresh, toast]);

  const handleApprove = React.useCallback(async (id: string) => {
    const res = await approveWeeklyTimesheet(id);
    if (res.ok) { toast({ title: 'Timesheet approved' }); refresh(); }
    else { toast({ title: 'Error', description: res.error, variant: 'destructive' }); }
  }, [refresh, toast]);

  const handleReject = React.useCallback(async (id: string) => {
    const res = await rejectWeeklyTimesheet(id, '');
    if (res.ok) { toast({ title: 'Timesheet rejected' }); refresh(); }
    else { toast({ title: 'Error', description: res.error, variant: 'destructive' }); }
  }, [refresh, toast]);

  // Bulk Actions
  const handleBulkSubmit = React.useCallback(() => {
    if (selected.size === 0) return;
    setBulkPending(true);
    bulkSubmitTimesheets(Array.from(selected)).then((res) => {
      setBulkPending(false);
      if (res.ok) { toast({ title: `${res.count} timesheet(s) submitted` }); setSelected(new Set()); refresh(); }
      else toast({ title: 'Error submitting', description: res.error, variant: 'destructive' });
    });
  }, [selected, refresh, toast]);

  const handleBulkApprove = React.useCallback(() => {
    if (selected.size === 0) return;
    setBulkPending(true);
    bulkApproveTimesheets(Array.from(selected)).then((res) => {
      setBulkPending(false);
      if (res.ok) { toast({ title: `${res.count} timesheet(s) approved` }); setSelected(new Set()); refresh(); }
      else toast({ title: 'Error approving', description: res.error, variant: 'destructive' });
    });
  }, [selected, refresh, toast]);

  const handleBulkReject = React.useCallback(() => {
    if (selected.size === 0) return;
    setBulkPending(true);
    bulkRejectTimesheets(Array.from(selected)).then((res) => {
      setBulkPending(false);
      if (res.ok) { toast({ title: `${res.count} timesheet(s) rejected` }); setSelected(new Set()); refresh(); }
      else toast({ title: 'Error rejecting', description: res.error, variant: 'destructive' });
    });
  }, [selected, refresh, toast]);

  const handleBulkDelete = React.useCallback(() => {
    if (selected.size === 0) return;
    setBulkPending(true);
    bulkDeleteTimesheets(Array.from(selected)).then((res) => {
      setBulkPending(false);
      if (res.ok) { toast({ title: `${res.count} timesheet(s) deleted` }); setSelected(new Set()); refresh(); }
      else { toast({ title: 'Error', description: res.error, variant: 'destructive' }); }
      setBulkDeleteOpen(false);
    });
  }, [selected, refresh, toast]);

  return {
    rows, loading, initialLoading, search, searchRaw: search, handleSearch,
    statusFilter, setStatusFilter, employeeFilter, setEmployeeFilter,
    fromDate, setFromDate, toDate, setToDate,
    hasMore, handleLoadMore, refresh,
    createOpen, setCreateOpen, editTarget, setEditTarget, deleteId, setDeleteId, deleteRow,
    selected, setSelected, bulkPending, bulkDeleteOpen, setBulkDeleteOpen,
    kpis, hasActiveFilters, clearFilters,
    allChecked, someChecked, toggleAll, toggleOne, selectedIds, hasSelection,
    handleConfirmDelete, handleSubmit, handleApprove, handleReject,
    handleBulkSubmit, handleBulkApprove, handleBulkReject, handleBulkDelete
  };
}
