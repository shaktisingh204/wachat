"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Input,
  Field,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Alert,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Eye, Boxes } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, InventoryItem } from '@/app/actions/finance/inventory.actions';

export function InventoryItemListClient({ initialItems, error }: { initialItems: InventoryItem[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
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

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

  return (
    <EntityListShell
      title="Multi-Warehouse Inventory"
      subtitle="Track inventory across multiple warehouses."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" iconLeft={Download} onClick={exportToCsv}>
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
                New Record
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit' : 'Create'} Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-1 py-4">
                <div className="grid gap-4">
                  <Field label="Sku">
                    <Input name="sku" defaultValue={editingItem?.sku ?? ''} required />
                  </Field>
                  <Field label="Name">
                    <Input name="name" defaultValue={editingItem?.name ?? ''} required />
                  </Field>
                  <Field label="Total Qty">
                    <Input
                      name="totalQty"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.totalQty ?? ''}
                      required
                    />
                  </Field>
                  <Field label="Status">
                    <Input name="status" defaultValue={editingItem?.status ?? ''} />
                  </Field>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" variant="primary" loading={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-6 flex items-center gap-2">
        <div className="w-full max-w-sm">
          <Input
            iconLeft={Search}
            placeholder="Search records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <THead>
          <Tr>
            <Th>Sku</Th>
            <Th>Name</Th>
            <Th>Total Qty</Th>
            <Th>Status</Th>
            <Th align="right" width={80}>
              <span className="sr-only">Actions</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {filteredItems.length === 0 ? (
            <Tr>
              <Td colSpan={5}>
                <EmptyState
                  icon={Boxes}
                  title="No records"
                  description="No inventory records match your search."
                />
              </Td>
            </Tr>
          ) : (
            filteredItems.map((item) => (
              <Tr key={item._id}>
                <Td>{String(item.sku ?? '')}</Td>
                <Td>{String(item.name ?? '')}</Td>
                <Td>{String(item.totalQty ?? '')}</Td>
                <Td>{String(item.status ?? '')}</Td>
                <Td align="right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton label="Open record actions" icon={MoreHorizontal} variant="ghost" size="sm" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem iconLeft={Eye} onClick={() => openView(item as any)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem iconLeft={Pencil} onClick={() => openEdit(item._id as string)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="danger" iconLeft={Trash} onClick={() => handleDelete(item._id as string)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-1 py-4">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b border-[var(--st-border)] pb-2">
                <div className="text-sm font-medium capitalize text-[var(--st-text-secondary)]">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm text-[var(--st-text)]">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
