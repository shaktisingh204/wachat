'use client';

import React, { useState, useMemo, useEffect, useOptimistic, useTransition, useCallback, useRef } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Checkbox, Table, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableHead, ZoruTableCell, EmptyState, Badge } from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { ExpenseClaim } from '@/lib/hrm-advanced-types';
import { saveExpenseClaim, deleteExpenseClaim, getExpenseClaims } from '@/app/actions/hrm-advanced/expense-policy';
import { ClaimForm } from './claim-form';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, RefreshCw, Trash, CheckCircle, XCircle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function ClientPage({ initialData }: { initialData: ExpenseClaim[] }) {
  const [data, setData] = useState<ExpenseClaim[]>(initialData);
  const [optimisticData, addOptimisticData] = useOptimistic(
    data,
    (state: ExpenseClaim[], newAction: { action: 'add' | 'update' | 'delete', claim: Partial<ExpenseClaim> }) => {
      if (newAction.action === 'delete') {
        return state.filter(c => c._id !== newAction.claim._id);
      }
      if (newAction.action === 'update') {
        return state.map(c => c._id === newAction.claim._id ? { ...c, ...newAction.claim } as ExpenseClaim : c);
      }
      return [...state, { ...newAction.claim, _id: newAction.claim._id || 'temp-' + Date.now() } as ExpenseClaim];
    }
  );

  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<Partial<ExpenseClaim> | undefined>(undefined);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newData = await getExpenseClaims();
        setData(newData);
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (payload: Partial<ExpenseClaim>) => {
    startTransition(() => {
      addOptimisticData({ action: payload._id ? 'update' : 'add', claim: payload });
    });
    
    try {
      await saveExpenseClaim(payload);
      toast({ title: 'Success', description: `Expense claim saved successfully.` });
      const refreshed = await getExpenseClaims();
      setData(refreshed);
    } catch (err: any) {
      toast({ title: 'Error saving claim', description: err.message, variant: 'destructive' });
      const refreshed = await getExpenseClaims();
      setData(refreshed);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this claim?')) return;
    
    startTransition(() => {
      addOptimisticData({ action: 'delete', claim: { _id: id } });
    });
    
    try {
      await deleteExpenseClaim(id);
      toast({ title: 'Success', description: `Claim deleted.` });
      const refreshed = await getExpenseClaims();
      setData(refreshed);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      toast({ title: 'Error deleting claim', description: err.message, variant: 'destructive' });
      const refreshed = await getExpenseClaims();
      setData(refreshed);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} claims?`)) return;
    
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => deleteExpenseClaim(id)));
      toast({ title: 'Success', description: `${ids.length} claims deleted.` });
      setSelectedIds(new Set());
      const refreshed = await getExpenseClaims();
      setData(refreshed);
    } catch (err: any) {
      toast({ title: 'Bulk delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkStatusUpdate = async (status: 'Approved' | 'Rejected') => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => {
        const claim = optimisticData.find(c => c._id === id);
        if (claim) {
          return saveExpenseClaim({ ...claim, status });
        }
        return Promise.resolve();
      }));
      toast({ title: 'Success', description: `${ids.length} claims ${status.toLowerCase()}.` });
      setSelectedIds(new Set());
      const refreshed = await getExpenseClaims();
      setData(refreshed);
    } catch (err: any) {
      toast({ title: `Bulk ${status.toLowerCase()} failed`, description: err.message, variant: 'destructive' });
    }
  };

  const handleExportCSV = useCallback(() => {
    const csv = Papa.unparse(optimisticData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `expense_claims_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [optimisticData]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.text('Expense Claims', 14, 15);
    const tableData = optimisticData.map(c => [
      c.employeeId, c.category, `$${c.amount}`, c.status, c.dateSubmitted
    ]);
    (doc as any).autoTable({
      head: [['Employee ID', 'Category', 'Amount', 'Status', 'Date']],
      body: tableData,
      startY: 20
    });
    doc.save(`expense_claims_${new Date().toISOString().split('T')[0]}.pdf`);
  }, [optimisticData]);

  const filteredData = useMemo(() => {
    return optimisticData.filter(item => {
      const matchesSearch = Object.values(item).some(v => 
        String(v).toLowerCase().includes(search.toLowerCase())
      );
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [optimisticData, search, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(c => c._id!).filter(Boolean)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    if (!isMounted) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved': return <Badge variant="success">Approved</Badge>;
      case 'Rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Approximate height of a row
    overscan: 5,
  });

  const bulkBar = selectedIds.size > 0 ? (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm font-medium">{selectedIds.size} selected</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('Approved')}><CheckCircle className="mr-2 h-4 w-4" /> Approve</Button>
        <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('Rejected')}><XCircle className="mr-2 h-4 w-4" /> Reject</Button>
        <Button size="sm" variant="destructive" onClick={handleBulkDelete}><Trash className="mr-2 h-4 w-4" /> Delete</Button>
      </div>
    </div>
  ) : null;

  const filters = (
    <div className="flex gap-2 items-center">
      <select
        className="h-9 rounded-md border border-zoru-line bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zoru-brand"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="All">All Statuses</option>
        <option value="Pending">Pending</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
      </select>
      <div className="flex items-center gap-2 border-l pl-2 border-zoru-line">
        <Button variant="ghost" size="sm" onClick={handleExportCSV} title="Export CSV">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportPDF} title="Export PDF">
          <FileText className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={async () => {
          const fresh = await getExpenseClaims();
          setData(fresh);
          toast({ title: 'Refreshed', description: 'Latest data fetched.' });
        }} title="Refresh Data">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <EntityListShell
        title="Expense Policy Engine"
        subtitle="Manage, filter, and approve employee expenses with real-time updates."
        search={{ value: search, onChange: setSearch, placeholder: 'Search claims...' }}
        filters={filters}
        bulkBar={bulkBar}
        primaryAction={
          <Button onClick={() => { setEditingClaim(undefined); setIsFormOpen(true); }}>
            Add Claim
          </Button>
        }
        empty={
          <EmptyState
            title="No expense claims found"
            description="Adjust your filters or add a new claim to get started."
            action={<Button onClick={() => { setEditingClaim(undefined); setIsFormOpen(true); }}>Add Claim</Button>}
          />
        }
      >
        <div className="rounded-md border border-zoru-line overflow-hidden bg-zoru-surface">
          <div ref={parentRef} className="max-h-[600px] overflow-auto relative">
            <Table>
              <ZoruTableHeader className="sticky top-0 bg-zoru-surface z-10 shadow-sm">
                <ZoruTableRow>
                  <ZoruTableHead className="w-12 text-center">
                    <Checkbox
                      checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all claims"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Employee</ZoruTableHead>
                  <ZoruTableHead>Category</ZoruTableHead>
                  <ZoruTableHead>Amount</ZoruTableHead>
                  <ZoruTableHead>Date</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = filteredData[virtualRow.index];
                  const id = row._id || `temp-${virtualRow.index}`;
                  return (
                    <ZoruTableRow
                      key={id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <ZoruTableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(id)}
                          onCheckedChange={() => toggleSelect(id)}
                          aria-label={`Select claim ${id}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium">{row.employeeId}</ZoruTableCell>
                      <ZoruTableCell>{row.category}</ZoruTableCell>
                      <ZoruTableCell>${Number(row.amount).toFixed(2)}</ZoruTableCell>
                      <ZoruTableCell>{formatDate(row.dateSubmitted)}</ZoruTableCell>
                      <ZoruTableCell>{getStatusBadge(row.status)}</ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingClaim(row); setIsFormOpen(true); }}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-zoru-ink hover:text-zoru-ink" onClick={() => handleDelete(id)}>Del</Button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </Table>
          </div>
        </div>
      </EntityListShell>

      <ClaimForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingClaim}
        onSave={handleSave}
      />
    </>
  );
}
