'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { saveBenefitPlan, deleteBenefitPlan, getBenefitPlans } from '@/app/actions/hrm-advanced/benefits-portal';
import { BenefitPlan } from '@/lib/hrm-advanced-types';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, EmptyState, Checkbox, Card, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Plus, Download, Trash, Edit, Search, FileText } from 'lucide-react';

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Benefits Portal Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Extract inline form into reusable component
function BenefitForm({
  initialData,
  onSave,
  onCancel
}: {
  initialData?: Partial<BenefitPlan>;
  onSave: (data: Partial<BenefitPlan>) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<BenefitPlan>>(initialData || { costToEmployee: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Plan Name</Label>
        <Input id="name" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="provider">Provider</Label>
        <Input id="provider" required value={formData.provider || ''} onChange={e => setFormData({ ...formData, provider: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="coverageDetails">Coverage Details</Label>
        <Input id="coverageDetails" value={formData.coverageDetails || ''} onChange={e => setFormData({ ...formData, coverageDetails: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="costToEmployee">Cost/mo ($)</Label>
        <Input id="costToEmployee" type="number" min="0" step="0.01" required value={formData.costToEmployee || 0} onChange={e => setFormData({ ...formData, costToEmployee: Number(e.target.value) })} />
      </div>
      <DialogFooter className="mt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
      </DialogFooter>
    </form>
  );
}

// Export functions
const exportToCSV = (data: BenefitPlan[]) => {
  const csv = Papa.unparse(data.map(item => ({
    'Plan Name': item.name,
    'Provider': item.provider,
    'Coverage Details': item.coverageDetails || 'N/A',
    'Cost to Employee': `$${item.costToEmployee}`
  })));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'benefits_export.csv';
  link.click();
};

const exportToPDF = (data: BenefitPlan[]) => {
  const doc = new jsPDF();
  doc.text('Benefits Portal Export', 14, 15);
  autoTable(doc, {
    head: [['Plan Name', 'Provider', 'Coverage Details', 'Cost to Employee']],
    body: data.map(item => [
      item.name, 
      item.provider, 
      item.coverageDetails || 'N/A', 
      `$${item.costToEmployee}`
    ]),
    startY: 20
  });
  doc.save('benefits_export.pdf');
};

export default function BenefitsPortalClient({ initialData }: { initialData: BenefitPlan[] }) {
  const [data, setData] = useState<BenefitPlan[]>(initialData);
  const { toast } = useToast();
  
  // Real-time updates simulation
  useEffect(() => {
    // 1. Mocking WebSocket for real-time collaborative updates
    const ws = new WebSocket('wss://echo.websocket.org');
    ws.onmessage = async (event) => {
      // Simulation: assume other client sent update
      if (typeof event.data === 'string' && event.data === 'SYNC_REFRESH') {
        const freshData = await getBenefitPlans();
        setData(freshData || []);
        toast({ title: 'Data updated', description: 'Another user made changes.' });
      }
    };
    
    // 2. BroadcastChannel for local tabs
    const channel = new BroadcastChannel('benefits_portal_collab');
    channel.onmessage = async (e) => {
      if (e.data === 'REFRESH') {
        const freshData = await getBenefitPlans();
        setData(freshData || []);
      }
    };

    return () => {
      ws.close();
      channel.close();
    };
  }, [toast]);

  const triggerRealTimeUpdate = () => {
    const channel = new BroadcastChannel('benefits_portal_collab');
    channel.postMessage('REFRESH');
    channel.close();
  };

  // Optimistic UI updates
  const handleSave = async (payload: Partial<BenefitPlan>) => {
    const tempId = payload._id || `temp-${Date.now()}`;
    const isEdit = !!payload._id;
    const optimisticItem = { ...payload, _id: tempId } as BenefitPlan;
    
    // Optimistic Update
    setData(prev => isEdit ? prev.map(p => p._id === payload._id ? optimisticItem : p) : [optimisticItem, ...prev]);
    setIsDialogOpen(false);
    
    try {
      const result = await saveBenefitPlan(payload);
      if (result.error) throw new Error(result.error);
      
      // Replace temp ID with actual ID
      if (!isEdit && result.data?._id) {
        setData(prev => prev.map(p => p._id === tempId ? { ...optimisticItem, _id: result.data._id } : p));
      }
      toast({ title: 'Success', description: 'Benefit plan saved successfully.' });
      triggerRealTimeUpdate();
    } catch (error: any) {
      // Rollback
      setData(prev => isEdit ? prev.map(p => p._id === payload._id ? initialData.find(d => d._id === payload._id)! : p) : prev.filter(p => p._id !== tempId));
      toast({ title: 'Error saving plan', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    const itemToDelete = data.find(d => d._id === id);
    
    // Optimistic Delete
    setData(prev => prev.filter(p => p._id !== id));
    
    try {
      await deleteBenefitPlan(id);
      toast({ title: 'Success', description: 'Plan deleted.' });
      triggerRealTimeUpdate();
    } catch (error: any) {
      // Rollback
      if (itemToDelete) setData(prev => [...prev, itemToDelete]);
      toast({ title: 'Error deleting plan', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} plans?`)) return;

    const idsToDelete = Array.from(selectedIds);
    const itemsToDelete = data.filter(d => idsToDelete.includes(d._id!));
    
    // Optimistic Delete
    setData(prev => prev.filter(p => !idsToDelete.includes(p._id!)));
    setSelectedIds(new Set());

    try {
      await Promise.all(idsToDelete.map(id => deleteBenefitPlan(id)));
      toast({ title: 'Success', description: `Deleted ${idsToDelete.length} plans.` });
      triggerRealTimeUpdate();
    } catch (error: any) {
      // Rollback
      setData(prev => [...prev, ...itemsToDelete]);
      toast({ title: 'Error in bulk delete', description: error.message, variant: 'destructive' });
    }
  };

  // Filters State
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('All');
  const [maxCostFilter, setMaxCostFilter] = useState<number | ''>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<BenefitPlan> | null>(null);

  // Selection Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.filter(d => !!d._id).map(d => d._id!)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Memoized derived data
  const providers = useMemo(() => Array.from(new Set(data.map(d => d.provider))), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.provider.toLowerCase().includes(search.toLowerCase());
      const matchesProvider = providerFilter === 'All' || item.provider === providerFilter;
      const matchesCost = maxCostFilter === '' || item.costToEmployee <= maxCostFilter;
      return matchesSearch && matchesProvider && matchesCost;
    });
  }, [data, search, providerFilter, maxCostFilter]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approx row height
    overscan: 5
  });

  return (
    <ErrorBoundary fallback={<div className="p-4 text-[var(--st-text)] rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]">Failed to load Benefits Portal. Please refresh the page.</div>}>
      <Card className="p-4 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-1 items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
              <Input placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Providers</SelectItem>
                {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Input 
              type="number" 
              placeholder="Max Cost ($)" 
              value={maxCostFilter} 
              onChange={e => setMaxCostFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32"
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.size})
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportToCSV(filteredData)}>
                  <FileText className="w-4 h-4 mr-2" /> Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToPDF(filteredData)}>
                  <FileText className="w-4 h-4 mr-2" /> Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Add Plan
            </Button>
          </div>
        </div>

        {/* Data Table with Virtualization */}
        <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] overflow-hidden flex flex-col h-[500px] shadow-[var(--st-shadow-sm)]">
          {/* Header */}
          <div className="bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] flex w-full font-medium text-[11px] text-[var(--st-text-tertiary)] uppercase tracking-wide">
            <div className="w-12 p-3 flex items-center justify-center">
              <Checkbox 
                checked={filteredData.length > 0 && selectedIds.size === filteredData.length} 
                onCheckedChange={toggleSelectAll} 
              />
            </div>
            <div className="flex-1 p-3">Plan Name</div>
            <div className="flex-1 p-3">Provider</div>
            <div className="flex-1 p-3">Coverage</div>
            <div className="w-32 p-3">Cost/mo</div>
            <div className="w-24 p-3 text-right">Actions</div>
          </div>
          
          {/* Body */}
          {filteredData.length === 0 ? (
            <div className="flex-1 p-8">
              <EmptyState 
                title="No benefit plans found" 
                description="Try adjusting your filters or add a new plan." 
                action={
                  <Button onClick={() => { setEditingItem(null); setIsDialogOpen(true); }}>
                    Add Plan
                  </Button>
                } 
              />
            </div>
          ) : (
            <div ref={parentRef} className="flex-1 overflow-auto relative bg-[var(--st-bg)]">
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = filteredData[virtualRow.index];
                  return (
                    <div 
                      key={row._id || virtualRow.index} 
                      className="absolute w-full flex items-center border-b border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)] transition-colors text-sm text-[var(--st-text)]"
                      style={{
                        top: 0,
                        left: 0,
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <div className="w-12 p-3 flex items-center justify-center">
                        <Checkbox checked={selectedIds.has(row._id!)} onCheckedChange={() => toggleSelect(row._id!)} />
                      </div>
                      <div className="flex-1 p-3 truncate font-medium">{row.name}</div>
                      <div className="flex-1 p-3 truncate">{row.provider}</div>
                      <div className="flex-1 p-3 truncate text-[var(--st-text-secondary)]">{row.coverageDetails || '-'}</div>
                      <div className="w-32 p-3 font-medium">${row.costToEmployee.toFixed(2)}</div>
                      <div className="w-24 p-3 flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text-tertiary)] hover:text-[var(--st-text)]" onClick={() => { setEditingItem(row); setIsDialogOpen(true); }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)]" onClick={() => handleDelete(row._id!)}>
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dialog for Add/Edit */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Benefit Plan' : 'Add Benefit Plan'}</DialogTitle>
            </DialogHeader>
            <BenefitForm 
              initialData={editingItem || undefined} 
              onSave={handleSave} 
              onCancel={() => setIsDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </Card>
    </ErrorBoundary>
  );
}
