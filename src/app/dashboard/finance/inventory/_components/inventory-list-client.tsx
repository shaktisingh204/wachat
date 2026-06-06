"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Table, TBody, Td, Th, THead, Tr, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Badge } from '@/components/sabcrm/20ui/compat';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Eye } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, InventoryItem } from '@/app/actions/finance/inventory.actions';
import { toast } from 'sonner';

export function InventoryItemListClient({ initialItems, error }: { initialItems: InventoryItem[], error?: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

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
    link.download = 'inventory_export.csv';
    link.click();
  }

  function openView(item: InventoryItem) {
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
        const res = await updateInventoryItem(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createInventoryItem(data);
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
      const res = await deleteInventoryItem(id);
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

  return (
    <EntityListShell
      title="Multi-Warehouse Inventory"
      subtitle="Track inventory across multiple warehouses."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New Record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Create'} Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Sku</Label>
              <Input 
                name="sku" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.sku : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("sku")} 
              />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input 
                name="name" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.name : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("name")} 
              />
            </div>
            <div className="space-y-1">
              <Label>TotalQty</Label>
              <Input 
                name="totalQty" 
                type="number"
                step="any"
                defaultValue={editingId ? items.find(i => i._id === editingId)?.totalQty : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("totalQty")} 
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
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-sm text-[var(--st-text)]">
          {error}
        </div>
      )}

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
          <THead>
            <Tr>
              <Th>Sku</Th><Th>Name</Th><Th>TotalQty</Th><Th>Status</Th>
              <Th className="w-[80px]"></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={5} className="h-24 text-center">
                  No results.
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.sku ?? '')}</Td><Td>{String(item.name ?? '')}</Td><Td>{String(item.totalQty ?? '')}</Td><Td>{String(item.status ?? '')}</Td>
                  <Td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(item as any)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(item._id as string)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[var(--st-text)] focus:bg-[var(--st-bg-muted)]" onClick={() => handleDelete(item._id as string)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
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
                <div className="font-medium text-sm text-[var(--st-text-secondary)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
