"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
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
  Alert,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Inbox } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createBankRecon, updateBankRecon, deleteBankRecon, BankRecon } from '@/app/actions/finance/bank-reconciliation.actions';
import { fmtDate, fmtINR } from '@/lib/utils';

const OPTIONAL_FIELDS = ['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'];

export function BankReconListClient({ initialItems, error }: { initialItems: BankRecon[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<BankRecon | null>(null);

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
    link.download = 'bank-reconciliation_export.csv';
    link.click();
  }

  function openView(item: BankRecon) {
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
      if (!isNaN(Number(val)) && val !== '' && key !== 'statementDate') {
        data[key] = Number(val);
      } else if (val === 'true' || val === 'false') {
        data[key] = val === 'true';
      } else {
        data[key] = val;
      }
    });

    try {
      if (editingId) {
        const res = await updateBankRecon(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createBankRecon(data);
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
      const res = await deleteBankRecon(id);
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
      title="Bank Reconciliation"
      subtitle="Reconcile bank statements with your internal ledgers."
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
                  <Field label="Account ID" required={!OPTIONAL_FIELDS.includes('accountId')}>
                    <Input
                      name="accountId"
                      defaultValue={editingItem?.accountId ?? ''}
                    />
                  </Field>
                  <Field label="Statement Date" required={!OPTIONAL_FIELDS.includes('statementDate')}>
                    <Input
                      name="statementDate"
                      type="date"
                      defaultValue={editingItem?.statementDate ? new Date(editingItem.statementDate).toISOString().split('T')[0] : ''}
                    />
                  </Field>
                  <Field label="Statement Balance" required={!OPTIONAL_FIELDS.includes('statementBalance')}>
                    <Input
                      name="statementBalance"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.statementBalance ?? ''}
                    />
                  </Field>
                  <Field label="Book Balance" required={!OPTIONAL_FIELDS.includes('bookBalance')}>
                    <Input
                      name="bookBalance"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.bookBalance ?? ''}
                    />
                  </Field>
                  <Field label="Status" required={!OPTIONAL_FIELDS.includes('status')}>
                    <Input
                      name="status"
                      defaultValue={editingItem?.status ?? ''}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" variant="primary" loading={loading} disabled={loading}>
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
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-6 flex items-center gap-2">
        <div className="w-full max-w-sm">
          <Input
            placeholder="Search records..."
            iconLeft={Search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <Table>
          <THead>
            <Tr>
              <Th>Account ID</Th>
              <Th>Statement Date</Th>
              <Th align="right">Statement Balance</Th>
              <Th align="right">Book Balance</Th>
              <Th>Status</Th>
              <Th align="right" width={80}>Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={Inbox}
                    title="No results"
                    description="No bank reconciliation records match your search."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.accountId ?? '')}</Td>
                  <Td>{item.statementDate ? fmtDate(new Date(item.statementDate)) : ''}</Td>
                  <Td align="right">{fmtINR(Number(item.statementBalance || 0))}</Td>
                  <Td align="right">{fmtINR(Number(item.bookBalance || 0))}</Td>
                  <Td>{String(item.status ?? '')}</Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" iconLeft={MoreHorizontal} aria-label="Row actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
