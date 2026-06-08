"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Field,
  Input,
  SelectField,
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
  Badge,
  type BadgeTone,
  StatCard,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Inbox, Wallet } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createPayout, updatePayout, deletePayout, Payout } from '@/app/actions/finance/payouts.actions';
import { fmtINR, fmtDate } from '@/lib/utils';

const RECIPIENT_TYPE_OPTIONS = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'VENDOR', label: 'Vendor' },
];

function statusTone(status: string | undefined): BadgeTone {
  switch (String(status ?? '').toLowerCase()) {
    case 'completed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function PayoutListClient({ initialItems }: { initialItems: Payout[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Payout | null>(null);
  const [recipientType, setRecipientType] = useState<string | null>(null);

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
    link.download = 'payouts_export.csv';
    link.click();
  }

  const filteredItems = items.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime/payouts`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'payout_update' && data.payout) {
            setItems(prev => prev.map(item => item._id === data.payout._id ? { ...item, ...data.payout } : item));
          } else if (data.type === 'payout_create' && data.payout) {
            setItems(prev => [data.payout, ...prev]);
          } else if (data.type === 'payout_delete' && data.payoutId) {
            setItems(prev => prev.filter(item => item._id !== data.payoutId));
          }
        } catch (e) {
          console.error('Failed to parse websocket message', e);
        }
      };
    } catch (e) {
      console.error('Failed to connect WebSocket', e);
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const totalPayouts = items.length;
  const pendingPayouts = items.filter(i => String(i.status).toLowerCase() === 'pending').length;
  const completedPayouts = items.filter(i => String(i.status).toLowerCase() === 'completed').length;

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
        const res = await updatePayout(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createPayout(data);
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
      const res = await deletePayout(id);
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
    setRecipientType(null);
    setIsDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setRecipientType(items.find(i => i._id === id)?.recipientType ?? null);
    setIsDialogOpen(true);
  }

  const editing = editingId ? items.find(i => i._id === editingId) : undefined;

  return (
    <EntityListShell
      title="Payouts"
      subtitle="Trigger and track direct payouts to employees and vendors."
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
                  <Field label="Recipient ID" required>
                    <Input
                      name="recipientId"
                      defaultValue={editing?.recipientId ?? ''}
                    />
                  </Field>
                  <Field label="Recipient Type" required>
                    <input type="hidden" name="recipientType" value={recipientType ?? ''} />
                    <SelectField
                      value={recipientType}
                      onChange={setRecipientType}
                      options={RECIPIENT_TYPE_OPTIONS}
                      placeholder="Select recipient type"
                      aria-label="Recipient Type"
                    />
                  </Field>
                  <Field label="Amount" required>
                    <Input
                      name="amount"
                      type="number"
                      step="any"
                      defaultValue={editing?.amount ?? ''}
                    />
                  </Field>
                  <Field label="Payment Method">
                    <Input
                      name="paymentMethod"
                      defaultValue={editing?.paymentMethod ?? ''}
                    />
                  </Field>
                  <Field label="Execution Date">
                    <Input
                      name="executionDate"
                      type="date"
                      defaultValue={editing?.executionDate ? new Date(editing.executionDate).toISOString().split('T')[0] : ''}
                    />
                  </Field>
                  <Field label="Status">
                    <Input
                      name="status"
                      defaultValue={editing?.status ?? ''}
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
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total payouts" value={totalPayouts} icon={Wallet} accent="#2563eb" />
        <StatCard label="Pending" value={pendingPayouts} accent="#d97706" />
        <StatCard label="Completed" value={completedPayouts} accent="#16a34a" />
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
              <Th>Recipient</Th>
              <Th>Type</Th>
              <Th align="right">Amount</Th>
              <Th>Payment method</Th>
              <Th>Execution date</Th>
              <Th>Status</Th>
              <Th width={80} align="right"><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={7}>
                  <EmptyState
                    icon={Inbox}
                    title="No payouts found"
                    description="No records match your search. New payouts will appear here."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">{String(item.recipientId ?? '—')}</Td>
                  <Td>{String(item.recipientType ?? '—')}</Td>
                  <Td align="right" className="tabular-nums">{fmtINR(item.amount)}</Td>
                  <Td>{String(item.paymentMethod ?? '—')}</Td>
                  <Td>{item.executionDate ? fmtDate(item.executionDate.toString()) : '—'}</Td>
                  <Td>
                    {item.status ? (
                      <Badge tone={statusTone(item.status)} dot>
                        {String(item.status)}
                      </Badge>
                    ) : <Badge tone="neutral">—</Badge>}
                  </Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label="Open row actions" icon={MoreHorizontal} variant="ghost" size="sm" />
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
