"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Field,
  Input,
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
  Card,
  EmptyState,
  Alert,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Eye, Inbox } from 'lucide-react';
import { createAsset, updateAsset, deleteAsset, Asset } from '@/app/actions/finance/assets.actions';
import { fmtINR } from '@/lib/utils';

export function AssetListClient({ initialItems, error }: { initialItems: Asset[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Asset | null>(null);

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
    link.download = 'assets_export.csv';
    link.click();
  }

  function openView(item: Asset) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

  const filteredItems = items.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

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
        const res = await updateAsset(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createAsset(data);
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
      const res = await deleteAsset(id);
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
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Asset Depreciation</PageTitle>
          <PageDescription>Track assets and their depreciation over time.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
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
              <form onSubmit={onSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-1 py-4">
                <Field label="Name" required>
                  <Input
                    name="name"
                    defaultValue={editingItem?.name ?? ''}
                  />
                </Field>
                <Field label="Purchase Price" required>
                  <Input
                    name="purchasePrice"
                    type="number"
                    step="any"
                    defaultValue={editingItem?.purchasePrice ?? ''}
                  />
                </Field>
                <Field label="Salvage Value">
                  <Input
                    name="salvageValue"
                    type="number"
                    step="any"
                    defaultValue={editingItem?.salvageValue ?? ''}
                  />
                </Field>
                <Field label="Useful Life Years" required>
                  <Input
                    name="usefulLifeYears"
                    type="number"
                    step="any"
                    defaultValue={editingItem?.usefulLifeYears ?? ''}
                  />
                </Field>
                <Field label="Accumulated Depreciation">
                  <Input
                    name="accumulatedDepreciation"
                    type="number"
                    step="any"
                    defaultValue={editingItem?.accumulatedDepreciation ?? ''}
                  />
                </Field>
                <DialogFooter>
                  <Button type="submit" variant="primary" loading={loading} disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </PageActions>
      </PageHeader>

      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : null}

      <div className="w-full max-w-sm">
        <Field label="Search records">
          <Input
            placeholder="Search records..."
            iconLeft={Search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>
      </div>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Purchase Price</Th>
              <Th>Salvage Value</Th>
              <Th>Useful Life Years</Th>
              <Th>Accumulated Depreciation</Th>
              <Th width={80} align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={Inbox}
                    title="No results"
                    description="No asset records match your search."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.name ?? '')}</Td>
                  <Td>{fmtINR(Number(item.purchasePrice || 0))}</Td>
                  <Td>{fmtINR(Number(item.salvageValue || 0))}</Td>
                  <Td>{String(item.usefulLifeYears ?? '')}</Td>
                  <Td>{fmtINR(Number(item.accumulatedDepreciation || 0))}</Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label="Row actions"
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
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
      </Card>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-1 py-4">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b border-[var(--st-border)] pb-2">
                <div className="text-sm font-medium capitalize text-[var(--st-text-secondary)]">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="col-span-2 text-sm text-[var(--st-text)]">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
