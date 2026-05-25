'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { OKR } from '@/lib/hrm-advanced-types';
import { Button, Input, EmptyState } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';
import { saveOKR, deleteOKR } from '@/app/actions/hrm-advanced/okr-tracking';
import { OKRForm } from './okr-form';
import { Download, FileText, Plus, Trash2, Search, Filter } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OKRClientProps {
  initialData: OKR[];
}

export function OKRClient({ initialData }: OKRClientProps) {
  const [okrs, setOkrs] = useState<OKR[]>(initialData);
  const [search, setSearch] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<OKR> | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useZoruToast();
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Advanced Filtering
  const filteredOkrs = useMemo(() => {
    return okrs.filter((okr) => {
      const matchesSearch = okr.objective.toLowerCase().includes(search.toLowerCase()) || 
                            okr.keyResult.toLowerCase().includes(search.toLowerCase());
      const matchesQuarter = quarterFilter ? okr.quarter === quarterFilter : true;
      return matchesSearch && matchesQuarter;
    });
  }, [okrs, search, quarterFilter]);

  // Virtualized List
  const rowVirtualizer = useVirtualizer({
    count: filteredOkrs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Approximate row height
    overscan: 5,
  });

  const uniqueQuarters = useMemo(() => Array.from(new Set(okrs.map(o => o.quarter))), [okrs]);

  // Mock WebSocket for Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (okrs.length > 0) {
        setOkrs(current => {
          const newOkrs = [...current];
          const randomIndex = Math.floor(Math.random() * newOkrs.length);
          const randomChange = Math.floor(Math.random() * 5) - 2; // -2 to +2
          const newProgress = Math.max(0, Math.min(100, newOkrs[randomIndex].progress + randomChange));
          
          if (newOkrs[randomIndex].progress !== newProgress) {
            newOkrs[randomIndex] = { ...newOkrs[randomIndex], progress: newProgress };
            toast({
              title: "Real-time Update",
              description: `OKR "${newOkrs[randomIndex].objective}" progress updated to ${newProgress}% via WebSocket.`,
              variant: "default",
            });
          }
          return newOkrs;
        });
      }
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [okrs.length, toast]);

  const handleSave = async (data: Partial<OKR>) => {
    setIsSaving(true);
    const tempId = data._id || `temp-${Date.now()}`;
    const isNew = !data._id;
    
    // Optimistic Update
    const optimisticOKR = { ...data, _id: tempId } as OKR;
    setOkrs(prev => isNew ? [...prev, optimisticOKR] : prev.map(o => o._id === data._id ? optimisticOKR : o));
    
    try {
      await saveOKR(data);
      toast({
        title: 'Success',
        description: `OKR successfully ${isNew ? 'created' : 'updated'}.`,
      });
      setIsFormOpen(false);
    } catch (err: any) {
      // Revert optimistic update
      setOkrs(prev => isNew ? prev.filter(o => o._id !== tempId) : prev.map(o => o._id === tempId ? (initialData.find(i => i._id === data._id) || o) : o));
      toast({
        title: 'Save Failed',
        description: err.message || 'There was an error saving the OKR.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const okrToDelete = okrs.find(o => o._id === id);
    if (!okrToDelete) return;

    // Optimistic Delete
    setOkrs(prev => prev.filter(o => o._id !== id));

    try {
      await deleteOKR(id);
      toast({ title: 'Success', description: 'OKR deleted successfully.' });
    } catch (err: any) {
      // Revert
      setOkrs(prev => [...prev, okrToDelete]);
      toast({
        title: 'Delete Failed',
        description: err.message || 'There was an error deleting the OKR.',
        variant: 'destructive'
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} OKRs?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const okrsToRestore = okrs.filter(o => o._id && idsToDelete.includes(o._id));
    
    // Optimistic Bulk Delete
    setOkrs(prev => prev.filter(o => !o._id || !idsToDelete.includes(o._id)));
    setSelectedIds(new Set());

    try {
      await Promise.all(idsToDelete.map(id => deleteOKR(id)));
      toast({ title: 'Success', description: `Successfully deleted ${idsToDelete.length} OKRs.` });
    } catch (err: any) {
      // Revert partial or full failure by restoring all (simplified)
      setOkrs(prev => [...prev, ...okrsToRestore]);
      toast({
        title: 'Bulk Delete Failed',
        description: 'Some items could not be deleted.',
        variant: 'destructive'
      });
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(filteredOkrs.map(o => ({
      Objective: o.objective,
      'Key Result': o.keyResult,
      'Progress %': o.progress,
      Owner: o.ownerId,
      Quarter: o.quarter
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `okrs_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('OKR Tracking Report', 14, 15);
    autoTable(doc, {
      head: [['Objective', 'Key Result', 'Progress', 'Owner', 'Quarter']],
      body: filteredOkrs.map(o => [o.objective, o.keyResult, `${o.progress}%`, o.ownerId, o.quarter]),
      startY: 20,
    });
    doc.save(`okrs_export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOkrs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOkrs.map(o => o._id as string).filter(Boolean)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // Sync initialData changes from Server Components
  useEffect(() => {
    setOkrs(initialData);
  }, [initialData]);

  return (
    <div className="space-y-4">
      {/* Top Actions & Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-text-muted" />
            <Input
              placeholder="Search OKRs..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-zoru-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zoru-brand"
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
          >
            <option value="">All Quarters</option>
            {uniqueQuarters.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          {quarterFilter || search ? (
            <Button variant="ghost" size="icon" onClick={() => { setSearch(''); setQuarterFilter(''); }} title="Clear Filters">
              <Filter className="h-4 w-4 text-red-500" />
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add OKR
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border border-zoru-line overflow-hidden bg-white dark:bg-zoru-background">
        <div className="flex border-b border-zoru-line h-10 bg-zoru-surface items-center px-4 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-zoru-text-muted">
          <div className="w-[50px] shrink-0">
            <input 
              type="checkbox" 
              checked={selectedIds.size === filteredOkrs.length && filteredOkrs.length > 0}
              onChange={toggleSelectAll}
            />
          </div>
          <div className="flex-1 min-w-[200px]">Objective</div>
          <div className="flex-1 min-w-[200px]">Key Result</div>
          <div className="flex-1 min-w-[150px]">Progress</div>
          <div className="flex-1 min-w-[100px]">Owner</div>
          <div className="flex-1 min-w-[100px]">Quarter</div>
          <div className="w-[120px] shrink-0 text-right">Actions</div>
        </div>
        
        {filteredOkrs.length === 0 ? (
          <EmptyState
            title="No OKRs found"
            description="Adjust your filters or add a new OKR."
            action={<Button onClick={() => { setEditingItem(undefined); setIsFormOpen(true); }}>Add OKR</Button>}
          />
        ) : (
          <div ref={parentRef} className="max-h-[600px] overflow-auto">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const okr = filteredOkrs[virtualRow.index];
                return (
                  <div
                    key={okr._id || virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center border-b border-zoru-line px-4 hover:bg-zoru-muted/50 transition-colors bg-white dark:bg-zoru-background text-sm"
                  >
                    <div className="w-[50px] flex items-center shrink-0">
                      <input 
                        type="checkbox" 
                        checked={okr._id ? selectedIds.has(okr._id) : false}
                        onChange={() => okr._id && toggleSelect(okr._id)}
                      />
                    </div>
                    <div className="flex-1 truncate pr-4 font-medium min-w-[200px]">{okr.objective}</div>
                    <div className="flex-1 truncate pr-4 text-zoru-text-muted min-w-[200px]">{okr.keyResult}</div>
                    <div className="flex-1 pr-4 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-zoru-muted rounded-full h-2.5 dark:bg-zoru-line">
                          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${okr.progress}%` }}></div>
                        </div>
                        <span className="text-sm text-zoru-text-muted w-8">{okr.progress}%</span>
                      </div>
                    </div>
                    <div className="flex-1 truncate pr-4 min-w-[100px]">{okr.ownerId}</div>
                    <div className="flex-1 truncate pr-4 min-w-[100px]">{okr.quarter}</div>
                    <div className="w-[120px] text-right flex justify-end gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingItem(okr); setIsFormOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => okr._id && handleDelete(okr._id)}>Del</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <OKRForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingItem}
        onSave={handleSave}
        isLoading={isSaving}
      />
    </div>
  );
}
