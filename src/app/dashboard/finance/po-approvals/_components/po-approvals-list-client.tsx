"use client";

import React, { useState } from 'react';
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
} from '@/components/sabcrm/20ui/compat';
import { Plus, MoreHorizontal, Pencil, Trash, Search, CheckCircle, XCircle, Download, Eye } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, PurchaseOrder } from '@/app/actions/finance/po-approvals.actions';
import { toast } from 'sonner';
import { fmtINR } from '@/lib/utils';

export function PurchaseOrderListClient({ initialItems }: { initialItems: PurchaseOrder[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<PurchaseOrder | null>(null);

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
    link.download = 'po-approvals_export.csv';
    link.click();
  }

  function openView(item: PurchaseOrder) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

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
        const res = await updatePurchaseOrder(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createPurchaseOrder(data);
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
      const res = await deletePurchaseOrder(id);
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

  async function handleApprove(id: string) {
    try {
      const res = await updatePurchaseOrder(id, { status: 'approved' });
      if (res.success) {
        toast.success('Approved successfully');
        setItems(items.map(i => i._id === id ? { ...i, status: 'approved' } : i));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to approve');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await updatePurchaseOrder(id, { status: 'rejected' });
      if (res.success) {
        toast.success('Rejected successfully');
        setItems(items.map(i => i._id === id ? { ...i, status: 'rejected' } : i));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to reject');
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

  return (
    <EntityListShell
      title="PO Approvals"
      subtitle="Approve purchase orders from vendors."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCsv}>
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
              <Label>VendorId</Label>
              <Input 
                name="vendorId" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.vendorId : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("vendorId")} 
              />
            </div>
            <div className="space-y-1">
              <Label>TotalAmount</Label>
              <Input 
                name="totalAmount" 
                type="number"
                step="any"
                defaultValue={editingId ? items.find(i => i._id === editingId)?.totalAmount : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("totalAmount")} 
              />
            </div>
            <div className="space-y-1">
              <Label>ApprovedBy</Label>
              <Input 
                name="approvedBy" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.approvedBy : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("approvedBy")} 
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Input 
                name="status" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.status : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("status")} 
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
      

      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
          <Input 
            placeholder="Search records..." 
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>VendorId</ZoruTableHead><ZoruTableHead>TotalAmount</ZoruTableHead><ZoruTableHead>ApprovedBy</ZoruTableHead><ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="w-[120px] text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredItems.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={5} className="h-24 text-center">
                  No results.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filteredItems.map((item) => (
                <ZoruTableRow key={item._id}>
                  <ZoruTableCell>{String(item.vendorId ?? '')}</ZoruTableCell>
                  <ZoruTableCell>{fmtINR(item.totalAmount)}</ZoruTableCell>
                  <ZoruTableCell>{String(item.approvedBy ?? '')}</ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {String(item.status ?? 'pending')}
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right flex items-center justify-end gap-1">
                    {item.status !== 'approved' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]" onClick={() => handleApprove(item._id as string)} title="Approve">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {item.status !== 'rejected' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]" onClick={() => handleReject(item._id as string)} title="Reject">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
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
                        <ZoruDropdownMenuItem className="text-[var(--st-text)] focus:bg-[var(--st-bg-muted)]" onClick={() => handleDelete(item._id as string)}>
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
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>View Details</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b pb-2">
                <div className="font-medium text-sm text-[var(--st-text-secondary)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
