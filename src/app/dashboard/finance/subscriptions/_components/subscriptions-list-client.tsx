"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, Table, TBody, Td, Th, THead, Tr, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Badge, Alert, AlertTitle, AlertDescription, EmptyState, StatCard } from '@/components/sabcrm/20ui/compat';
import { Plus, MoreHorizontal, Pencil, Trash, Search, DollarSign, Calendar, CreditCard, AlertCircle, Download, Eye } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createSubscription, updateSubscription, deleteSubscription, Subscription } from '@/app/actions/finance/subscriptions.actions';
import { toast } from 'sonner';
import { fmtINR, fmtDate } from '@/lib/utils';

export function SubscriptionListClient({ initialItems, error }: { initialItems: Subscription[], error?: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Subscription | null>(null);

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
              <Label>CustomerId</Label>
              <Input 
                name="customerId" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.customerId : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("customerId")} 
              />
            </div>
            <div className="space-y-1">
              <Label>PlanId</Label>
              <Input 
                name="planId" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.planId : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("planId")} 
              />
            </div>
            <div className="space-y-1">
              <Label>BillingCycle</Label>
              <Input 
                name="billingCycle" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.billingCycle : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("billingCycle")} 
              />
            </div>
            <div className="space-y-1">
              <Label>NextBillingDate</Label>
              <Input 
                name="nextBillingDate" 
                type="date"
                defaultValue={editingId ? (items.find(i => i._id === editingId)?.nextBillingDate ? new Date(items.find(i => i._id === editingId)!.nextBillingDate!).toISOString().split('T')[0] : '') : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("nextBillingDate")} 
              />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input 
                name="amount" 
                type="number"
                step="any"
                defaultValue={editingId ? items.find(i => i._id === editingId)?.amount : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("amount")} 
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
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Subscriptions</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && items.length === 0 ? (
        <EmptyState 
          title="No subscriptions yet"
          description="Create your first subscription to track recurring revenue."
          icon={<CreditCard className="h-6 w-6" />}
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Add Subscription
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard 
              label="MRR" 
              value={fmtINR(mrr)} 
              icon={<DollarSign className="text-[var(--st-text-secondary)]" />} 
            />
            <StatCard 
              label="ARR" 
              value={fmtINR(arr)} 
              icon={<DollarSign className="text-[var(--st-text-secondary)]" />} 
            />
            <StatCard 
              label="Upcoming Renewals (30 Days)" 
              value={upcomingRenewals.toString()} 
              icon={<Calendar className="text-[var(--st-text-secondary)]" />} 
            />
          </div>

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
                  <Th>CustomerId</Th><Th>PlanId</Th><Th>BillingCycle</Th><Th>NextBillingDate</Th><Th>Amount</Th><Th>Status</Th>
                  <Th className="w-[80px]"></Th>
                </Tr>
              </THead>
              <TBody>
                {filteredItems.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="h-24 text-center">
                      No results.
                    </Td>
                  </Tr>
                ) : (
                  filteredItems.map((item) => (
                    <Tr key={item._id}>
                      <Td>{String(item.customerId ?? '')}</Td><Td>{String(item.planId ?? '')}</Td><Td>{String(item.billingCycle ?? '')}</Td><Td>{item.nextBillingDate ? fmtDate(item.nextBillingDate.toString()) : ''}</Td><Td>{fmtINR(item.amount)}</Td><Td>{String(item.status ?? '')}</Td>
                      <Td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
        </>
      )}

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
