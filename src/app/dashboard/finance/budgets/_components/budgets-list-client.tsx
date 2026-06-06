"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Input,
  Field,
  Card,
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
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Alert,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Eye, Inbox } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createBudget, updateBudget, deleteBudget, Budget } from '@/app/actions/finance/budgets.actions';
import { fmtINR } from '@/lib/utils';

const OPTIONAL_FIELDS = [
  'credit',
  'debit',
  'exchangeRate',
  'salvageValue',
  'accumulatedDepreciation',
  'approvedBy',
  'variance',
  'status',
];

export function BudgetListClient({ initialItems, error }: { initialItems: Budget[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Budget | null>(null);

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
    link.download = 'budgets_export.csv';
    link.click();
  }

  function openView(item: Budget) {
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
        const res = await updateBudget(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createBudget(data);
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
      const res = await deleteBudget(id);
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
      title="Budget vs Actuals"
      subtitle="Compare budgeted expenses against actuals."
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
                <DialogDescription>
                  {editingId ? 'Update this budget record.' : 'Add a new budget record.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-1 py-4">
                <div className="grid gap-4">
                  <Field label="Department ID" required={!OPTIONAL_FIELDS.includes('departmentId')}>
                    <Input
                      name="departmentId"
                      defaultValue={editingItem?.departmentId ?? ''}
                    />
                  </Field>
                  <Field label="Fiscal Year" required={!OPTIONAL_FIELDS.includes('fiscalYear')}>
                    <Input
                      name="fiscalYear"
                      defaultValue={editingItem?.fiscalYear ?? ''}
                    />
                  </Field>
                  <Field label="Budgeted Amount" required={!OPTIONAL_FIELDS.includes('budgetedAmount')}>
                    <Input
                      name="budgetedAmount"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.budgetedAmount ?? ''}
                    />
                  </Field>
                  <Field label="Actual Spent" required={!OPTIONAL_FIELDS.includes('actualSpent')}>
                    <Input
                      name="actualSpent"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.actualSpent ?? ''}
                    />
                  </Field>
                  <Field label="Variance" required={!OPTIONAL_FIELDS.includes('variance')}>
                    <Input
                      name="variance"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.variance ?? ''}
                    />
                  </Field>
                </div>
                <DialogFooter>
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
            aria-label="Search records"
          />
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Department ID</Th>
              <Th>Fiscal Year</Th>
              <Th align="right">Budgeted Amount</Th>
              <Th align="right">Actual Spent</Th>
              <Th align="right">Variance</Th>
              <Th align="right" width={80}><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={Inbox}
                    title="No results"
                    description="No budget records match your search."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.departmentId ?? '')}</Td>
                  <Td>{String(item.fiscalYear ?? '')}</Td>
                  <Td align="right">{fmtINR(Number(item.budgetedAmount || 0))}</Td>
                  <Td align="right">{fmtINR(Number(item.actualSpent || 0))}</Td>
                  <Td align="right">{fmtINR(Number(item.variance || 0))}</Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label="Row actions" icon={MoreHorizontal} variant="ghost" size="sm" />
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
            <DialogDescription>Full details for the selected budget record.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-1 py-4">
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
    </EntityListShell>
  );
}
