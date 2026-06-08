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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Badge,
  type BadgeTone,
  EmptyState,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash,
  Search,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  Clock,
  Wallet,
} from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, PurchaseOrder } from '@/app/actions/finance/po-approvals.actions';
import { fmtINR } from '@/lib/utils';

const STATUS_TONE: Record<string, BadgeTone> = {
  approved: 'success',
  rejected: 'danger',
};

export function PurchaseOrderListClient({ initialItems }: { initialItems: PurchaseOrder[] }) {
  const router = useRouter();
  const { toast } = useToast();
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

  const pendingCount = items.filter(i => !i.status || String(i.status).toLowerCase() === 'pending').length;
  const approvedCount = items.filter(i => String(i.status).toLowerCase() === 'approved').length;
  const pendingValue = items
    .filter(i => !i.status || String(i.status).toLowerCase() === 'pending')
    .reduce((a, i) => a + (Number(i.totalAmount) || 0), 0);

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

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

  return (
    <EntityListShell
      title="Purchase order approvals"
      subtitle="Review and approve purchase orders raised against your vendors."
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
              <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-1 py-4">
                <div className="grid gap-4">
                  <Field label="Vendor ID" required>
                    <Input
                      name="vendorId"
                      defaultValue={editingItem?.vendorId ?? ''}
                    />
                  </Field>
                  <Field label="Total Amount" required>
                    <Input
                      name="totalAmount"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.totalAmount ?? ''}
                    />
                  </Field>
                  <Field label="Approved By">
                    <Input
                      name="approvedBy"
                      defaultValue={editingItem?.approvedBy ?? ''}
                    />
                  </Field>
                  <Field label="Status">
                    <Input
                      name="status"
                      defaultValue={editingItem?.status ?? ''}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" variant="primary" loading={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting approval" value={pendingCount} icon={Clock} accent="#d97706" />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle} accent="#16a34a" />
        <StatCard label="Pending value" value={fmtINR(pendingValue)} icon={Wallet} accent="#2563eb" />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <div className="w-full max-w-sm">
          <Field label="Search records">
            <Input
              iconLeft={Search}
              placeholder="Search records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <Table>
          <THead>
            <Tr>
              <Th>Vendor</Th>
              <Th align="right">Total amount</Th>
              <Th>Approved by</Th>
              <Th>Status</Th>
              <Th align="right" width={120}><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={5}>
                  <EmptyState
                    icon={FileText}
                    title="No purchase orders"
                    description="No records match your search. New purchase orders will appear here."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => {
                const status = String(item.status ?? 'pending');
                return (
                  <Tr key={item._id}>
                    <Td className="font-medium">{String(item.vendorId ?? '—')}</Td>
                    <Td align="right" className="tabular-nums">{fmtINR(item.totalAmount)}</Td>
                    <Td>{String(item.approvedBy ?? '—')}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[status] ?? 'warning'} dot>{status}</Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status !== 'approved' && (
                          <IconButton
                            label="Approve"
                            icon={CheckCircle}
                            onClick={() => handleApprove(item._id as string)}
                          />
                        )}
                        {item.status !== 'rejected' && (
                          <IconButton
                            label="Reject"
                            icon={XCircle}
                            onClick={() => handleReject(item._id as string)}
                          />
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label="More actions" icon={MoreHorizontal} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem iconLeft={Pencil} onClick={() => openEdit(item._id as string)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem iconLeft={FileText} onClick={() => openView(item)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="danger" iconLeft={Trash} onClick={() => handleDelete(item._id as string)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </div>

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
