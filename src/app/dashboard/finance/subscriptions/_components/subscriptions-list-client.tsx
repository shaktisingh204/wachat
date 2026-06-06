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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  EmptyState,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, DollarSign, Calendar, CreditCard, Download } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createSubscription, updateSubscription, deleteSubscription, Subscription } from '@/app/actions/finance/subscriptions.actions';
import { fmtINR, fmtDate } from '@/lib/utils';

const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const;
const STATUSES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;

export function SubscriptionListClient({ initialItems, error }: { initialItems: Subscription[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Subscription | null>(null);

  const editing = editingId ? items.find(i => i._id === editingId) : undefined;

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
    link.download = 'subscriptions_export.csv';
    link.click();
  }

  function openView(item: Subscription) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

  const filteredItems = items.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const activeItems = items.filter(item => !item.status || String(item.status).toUpperCase() === 'ACTIVE');

  const mrr = activeItems.reduce((acc, item) => {
    const amount = Number(item.amount) || 0;
    const cycle = String(item.billingCycle).toUpperCase();
    if (cycle === 'YEARLY') return acc + (amount / 12);
    return acc + amount;
  }, 0);

  const arr = mrr * 12;

  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(next30Days.getDate() + 30);

  const upcomingRenewals = activeItems.filter(item => {
    if (!item.nextBillingDate) return false;
    const billingDate = new Date(item.nextBillingDate);
    return billingDate >= now && billingDate <= next30Days;
  }).length;

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
        const res = await updateSubscription(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createSubscription(data);
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
      const res = await deleteSubscription(id);
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
      title="Subscriptions Billing"
      subtitle="Manage recurring billing and subscriptions."
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
              {/* `editingId` keys the form so defaultValues reset between create/edit. */}
              <form key={editingId ?? 'new'} onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto px-1 py-4">
                <div className="grid gap-4">
                  <Field label="Customer ID" required>
                    <Input name="customerId" defaultValue={editing?.customerId ?? ''} required />
                  </Field>
                  <Field label="Plan ID" required>
                    <Input name="planId" defaultValue={editing?.planId ?? ''} required />
                  </Field>
                  <Field label="Billing Cycle" required>
                    <Select name="billingCycle" defaultValue={editing?.billingCycle ?? 'MONTHLY'}>
                      <SelectTrigger aria-label="Billing Cycle">
                        <SelectValue placeholder="Select a billing cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_CYCLES.map(cycle => (
                          <SelectItem key={cycle} value={cycle}>{cycle}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Next Billing Date" required>
                    <Input
                      name="nextBillingDate"
                      type="date"
                      defaultValue={editing?.nextBillingDate ? new Date(editing.nextBillingDate).toISOString().split('T')[0] : ''}
                      required
                    />
                  </Field>
                  <Field label="Amount" required>
                    <Input
                      name="amount"
                      type="number"
                      step="any"
                      defaultValue={editing?.amount ?? ''}
                      required
                    />
                  </Field>
                  <Field label="Status">
                    <Select name="status" defaultValue={editing?.status ?? 'ACTIVE'}>
                      <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
        <Alert tone="danger" title="Error Loading Subscriptions" className="mb-6">
          {error}
        </Alert>
      )}

      {!error && items.length === 0 ? (
        <EmptyState
          title="No subscriptions yet"
          description="Create your first subscription to track recurring revenue."
          icon={CreditCard}
          action={
            <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
              Add Subscription
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="MRR" value={fmtINR(mrr)} icon={DollarSign} />
            <StatCard label="ARR" value={fmtINR(arr)} icon={DollarSign} />
            <StatCard label="Upcoming Renewals (30 Days)" value={upcomingRenewals.toString()} icon={Calendar} />
          </div>

          <div className="mb-6 flex items-center gap-2">
            <div className="w-full max-w-sm">
              <Input
                placeholder="Search records..."
                iconLeft={Search}
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search records"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            <Table>
              <THead>
                <Tr>
                  <Th>Customer ID</Th>
                  <Th>Plan ID</Th>
                  <Th>Billing Cycle</Th>
                  <Th>Next Billing Date</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  <Th width={80}></Th>
                </Tr>
              </THead>
              <TBody>
                {filteredItems.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} align="center">
                      No results.
                    </Td>
                  </Tr>
                ) : (
                  filteredItems.map((item) => (
                    <Tr key={item._id}>
                      <Td>{String(item.customerId ?? '')}</Td>
                      <Td>{String(item.planId ?? '')}</Td>
                      <Td>{String(item.billingCycle ?? '')}</Td>
                      <Td>{item.nextBillingDate ? fmtDate(item.nextBillingDate.toString()) : ''}</Td>
                      <Td align="right">{fmtINR(item.amount)}</Td>
                      <Td>{String(item.status ?? '')}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label="Row actions" icon={MoreHorizontal} size="sm" />
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
        </>
      )}

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
