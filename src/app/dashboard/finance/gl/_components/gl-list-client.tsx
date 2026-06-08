"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';
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
  Alert,
  Badge,
  EmptyState,
  StatCard,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Eye, Inbox, BookOpen, Coins, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createGlEntry, updateGlEntry, deleteGlEntry, GlEntry } from '@/app/actions/finance/gl.actions';
import { fmtDate, fmtINR } from '@/lib/utils';

const OPTIONAL_FIELDS = ['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'];

export function GlEntryListClient({ initialItems, error }: { initialItems: GlEntry[], error?: string }) {
  gsapCore.registerPlugin(useGSAP);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<GlEntry | null>(null);

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
    link.download = 'gl_export.csv';
    link.click();
  }

  function openView(item: GlEntry) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

  useGSAP(() => {
    gsapCore.fromTo('.animate-row', {
      opacity: 0,
      x: -10
    }, {
      opacity: 1,
      x: 0,
      stagger: 0.05,
      duration: 0.3,
      ease: 'power1.out'
    });
  }, { scope: containerRef, dependencies: [items, search] });

  const filteredItems = items.filter(item =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const totalDebit = items.reduce((a, i) => a + (Number(i.debit) || 0), 0);
  const totalCredit = items.reduce((a, i) => a + (Number(i.credit) || 0), 0);
  const currencyCount = new Set(items.map(i => i.currency || 'INR')).size;

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data: any = {};
    formData.forEach((val, key) => {
      if (!isNaN(Number(val)) && val !== '' && key !== 'transactionDate') {
        data[key] = Number(val);
      } else if (val === 'true' || val === 'false') {
        data[key] = val === 'true';
      } else {
        data[key] = val;
      }
    });

    try {
      if (editingId) {
        const res = await updateGlEntry(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createGlEntry(data);
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
      const res = await deleteGlEntry(id);
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
    <div ref={containerRef}>
    <EntityListShell
      title="General ledger"
      subtitle="Multi-currency ledger entries with live exchange rates."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" iconLeft={Download} onClick={exportToCsv}>
            Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" iconLeft={Plus} onClick={openNew}>
              New Record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit' : 'Create'} Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-4">
                <Field label="Currency" required={!OPTIONAL_FIELDS.includes('currency')}>
                  <Input
                    name="currency"
                    defaultValue={editingId ? editingItem?.currency : 'INR'}
                  />
                </Field>
                <Field label="Base Amount" required={!OPTIONAL_FIELDS.includes('baseAmount')}>
                  <Input
                    name="baseAmount"
                    type="number"
                    step="any"
                    defaultValue={editingId ? editingItem?.baseAmount : ''}
                  />
                </Field>
                <Field label="Exchange Rate" required={!OPTIONAL_FIELDS.includes('exchangeRate')}>
                  <Input
                    name="exchangeRate"
                    type="number"
                    step="any"
                    defaultValue={editingId ? editingItem?.exchangeRate : ''}
                  />
                </Field>
                <Field label="Account Id" required={!OPTIONAL_FIELDS.includes('accountId')}>
                  <Input
                    name="accountId"
                    defaultValue={editingId ? editingItem?.accountId : ''}
                  />
                </Field>
                <Field label="Credit" required={!OPTIONAL_FIELDS.includes('credit')}>
                  <Input
                    name="credit"
                    type="number"
                    step="any"
                    defaultValue={editingId ? editingItem?.credit : ''}
                  />
                </Field>
                <Field label="Debit" required={!OPTIONAL_FIELDS.includes('debit')}>
                  <Input
                    name="debit"
                    type="number"
                    step="any"
                    defaultValue={editingId ? editingItem?.debit : ''}
                  />
                </Field>
                <Field label="Transaction Date" required={!OPTIONAL_FIELDS.includes('transactionDate')}>
                  <Input
                    name="transactionDate"
                    type="date"
                    defaultValue={editingId ? editingItem?.transactionDate ? new Date(editingItem.transactionDate).toISOString().split('T')[0] : '' : ''}
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
        <div className="mb-4">
          <Alert variant="error" title="Could not load records">
            {error}
          </Alert>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entries" value={items.length} icon={BookOpen} accent="#2563eb" />
        <StatCard label="Currencies" value={currencyCount} icon={Coins} accent="#0891b2" />
        <StatCard label="Total debit" value={fmtINR(totalDebit)} icon={ArrowDownLeft} accent="#d97706" />
        <StatCard label="Total credit" value={fmtINR(totalCredit)} icon={ArrowUpRight} accent="#16a34a" />
      </div>

      <div className="mb-6 flex items-center gap-2">
        <div className="flex-1 max-w-sm">
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

      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Account</Th>
              <Th>Currency</Th>
              <Th align="right">Base amount</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Debit</Th>
              <Th align="right">Credit</Th>
              <Th>Date</Th>
              <Th width={80} align="right"><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={8}>
                  <EmptyState
                    icon={Inbox}
                    title="No results"
                    description="No general ledger records match your search."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id} className="animate-row">
                  <Td className="font-medium">{String(item.accountId ?? '—')}</Td>
                  <Td><Badge tone="neutral">{String(item.currency ?? 'INR')}</Badge></Td>
                  <Td align="right" className="tabular-nums">{fmtINR(Number(item.baseAmount || 0), item.currency || 'INR')}</Td>
                  <Td align="right" className="tabular-nums text-[var(--st-text-secondary)]">{item.exchangeRate ? Number(item.exchangeRate).toFixed(2) : '—'}</Td>
                  <Td align="right" className="tabular-nums">{fmtINR(Number(item.debit || 0), item.currency || 'INR')}</Td>
                  <Td align="right" className="tabular-nums">{fmtINR(Number(item.credit || 0), item.currency || 'INR')}</Td>
                  <Td>{item.transactionDate ? fmtDate(new Date(item.transactionDate)) : '—'}</Td>
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
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b border-[var(--st-border)] pb-2">
                <div className="font-medium text-sm text-[var(--st-text-secondary)] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm text-[var(--st-text)]">{String(value)}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </EntityListShell>
    </div>
  );
}
