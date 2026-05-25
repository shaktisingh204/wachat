"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Button, 
  Input, 
  Label, 
  Table, 
  ZoruTableBody, 
  ZoruTableCell, 
  ZoruTableHead, 
  ZoruTableHeader, 
  ZoruTableRow,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Badge,
} from '@/components/zoruui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Download, Eye } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createTaxRecord, updateTaxRecord, deleteTaxRecord, exportTaxRecordsCSV, TaxRecord } from '@/app/actions/finance/taxes.actions';
import { toast } from 'sonner';
import { fmtINR } from '@/lib/utils';

export function TaxRecordListClient({ initialItems, error, initialPeriod }: { initialItems: TaxRecord[], error?: string, initialPeriod?: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(initialPeriod || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<TaxRecord | null>(null);

  function exportToCsv() {
    if (items.length === 0) return;
    const headers = Object.keys(items[0] || {}).filter(k => k !== '_id' && k !== '__v');
    const csvContent = [
      headers.join(','),
      ...items.map(item => headers.map(h => JSON.stringify((item as any)[h] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'taxes_export.csv';
    link.click();
  }

  function openView(item: TaxRecord) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

  useEffect(() => {
    setItems(initialItems || []);
  }, [initialItems]);

  useEffect(() => {
    setPeriodFilter(initialPeriod || '');
  }, [initialPeriod]);

  const filteredItems = items.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((val, key) => {
      if (!isNaN(Number(val)) && val !== '') {
        data[key] = Number(val);
      } else if (val === 'true' || val === 'false') {
        data[key] = val === 'true';
      } else {
        data[key] = val;
      }
    });

    try {
      if (editingId) {
        const res = await updateTaxRecord(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createTaxRecord(data);
        if (res.success) {
          toast.success('Created successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await deleteTaxRecord(id);
      if (res.success) {
        toast.success('Deleted successfully');
        setItems(items.filter(i => i._id !== id));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function openNew() {
    setEditingId(null);
    setIsDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setIsDialogOpen(true);
  }

  async function handleExport() {
    try {
      const res = await exportTaxRecordsCSV({ period: periodFilter });
      if (res.error) throw new Error(res.error);
      if (res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax_records${periodFilter ? '_' + periodFilter : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to export CSV');
    }
  }

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (periodFilter) {
      url.searchParams.set('period', periodFilter);
    } else {
      url.searchParams.delete('period');
    }
    router.push(url.pathname + url.search);
  }

  // Summary Widgets calculation
  const totalTaxable = items.reduce((acc, i) => acc + (Number(i.taxableIncome) || 0), 0);
  const totalOwed = items.reduce((acc, i) => acc + (Number(i.taxOwed) || 0), 0);
  const byJurisdiction = items.reduce((acc, i) => {
    const j = i.jurisdiction || 'Unknown';
    if (!acc[j]) acc[j] = { income: 0, owed: 0 };
    acc[j].income += Number(i.taxableIncome) || 0;
    acc[j].owed += Number(i.taxOwed) || 0;
    return acc;
  }, {} as Record<string, { income: number, owed: number }>);

  return (
    <EntityListShell
      title="Tax Filing"
      subtitle="Manage and file your organization taxes."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <ZoruDialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> New Record
              </Button>
            </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>{editingId ? 'Edit' : 'Create'} Record</ZoruDialogTitle>
            </ZoruDialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-4">
            <div className="space-y-1">
              <Label>TaxPeriod</Label>
              <Input 
                name="taxPeriod" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.taxPeriod : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("taxPeriod")} 
              />
            </div>
            <div className="space-y-1">
              <Label>Jurisdiction</Label>
              <Input 
                name="jurisdiction" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.jurisdiction : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("jurisdiction")} 
              />
            </div>
            <div className="space-y-1">
              <Label>TaxableIncome</Label>
              <Input 
                name="taxableIncome" 
                type="number"
                step="any"
                defaultValue={editingId ? items.find(i => i._id === editingId)?.taxableIncome : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("taxableIncome")} 
              />
            </div>
            <div className="space-y-1">
              <Label>TaxOwed</Label>
              <Input 
                name="taxOwed" 
                type="number"
                step="any"
                defaultValue={editingId ? items.find(i => i._id === editingId)?.taxOwed : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("taxOwed")} 
              />
            </div>
            <div className="space-y-1">
              <Label>IsFiled</Label>
              <Input 
                name="isFiled" 
                defaultValue={editingId ? String(items.find(i => i._id === editingId)?.isFiled ?? '') : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("isFiled")} 
              />
            </div></div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </ZoruDialogContent>
        </Dialog>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Summary Widgets */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2">Total Taxable Income</div>
          <div className="text-2xl font-bold">{fmtINR(totalTaxable)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground mb-2">Total Tax Owed</div>
          <div className="text-2xl font-bold">{fmtINR(totalOwed)}</div>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm max-h-[120px] overflow-y-auto">
          <div className="text-sm font-medium text-muted-foreground mb-2">By Jurisdiction (Owed)</div>
          <div className="space-y-1">
            {Object.entries(byJurisdiction).map(([j, vals]: [string, any]) => (
              <div key={j} className="flex justify-between text-sm">
                <span>{j}</span>
                <span className="font-semibold">{fmtINR(vals.owed)}</span>
              </div>
            ))}
            {Object.keys(byJurisdiction).length === 0 && (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search records..." 
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <form onSubmit={handleFilter} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Filter by Period (e.g. 2024)"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full sm:w-[200px]"
          />
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>TaxPeriod</ZoruTableHead><ZoruTableHead>Jurisdiction</ZoruTableHead><ZoruTableHead>TaxableIncome</ZoruTableHead><ZoruTableHead>TaxOwed</ZoruTableHead><ZoruTableHead>IsFiled</ZoruTableHead>
              <ZoruTableHead className="w-[80px]"></ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredItems.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6} className="h-24 text-center">
                  No results.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filteredItems.map((item) => (
                <ZoruTableRow key={item._id}>
                  <ZoruTableCell>{String(item.taxPeriod ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.jurisdiction ?? '')}</ZoruTableCell><ZoruTableCell>{fmtINR(item.taxableIncome)}</ZoruTableCell><ZoruTableCell>{fmtINR(item.taxOwed)}</ZoruTableCell><ZoruTableCell>{String(item.isFiled ?? '')}</ZoruTableCell>
                  <ZoruTableCell>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={() => openEdit(item._id as string)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem className="text-red-600 focus:bg-red-50" onClick={() => handleDelete(item._id as string)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </Table>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b pb-2">
                <div className="font-medium text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
