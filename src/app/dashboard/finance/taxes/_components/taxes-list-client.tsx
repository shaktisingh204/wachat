"use client";

import React, { useState, useEffect } from 'react';
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
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Badge,
  Alert,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Download, Receipt, Wallet, Coins } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createTaxRecord, updateTaxRecord, deleteTaxRecord, exportTaxRecordsCSV, TaxRecord } from '@/app/actions/finance/taxes.actions';
import { fmtINR } from '@/lib/utils';

const OPTIONAL_FIELDS = ['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'];

export function TaxRecordListClient({ initialItems, error, initialPeriod }: { initialItems: TaxRecord[], error?: string, initialPeriod?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(initialPeriod || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<TaxRecord | null>(null);

  function openView(item: TaxRecord) {
    setViewingItem(item);
    setIsViewOpen(true);
  }

  useEffect(() => {
    setItems(initialItems || []);
  }, [initialItems]);

  useEffect(() => {
    setPeriodFilter(initialPeriod || '');
  }, [initialPeriod]);

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
        const res = await updateTaxRecord(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createTaxRecord(data);
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
      const res = await deleteTaxRecord(id);
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

  async function handleExport() {
    try {
      const res = await exportTaxRecordsCSV({ period: periodFilter });
      if (res.error) throw new Error(res.error);
      if (res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax_records${periodFilter ? '_' + periodFilter : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to export CSV');
    }
  }

  function handleFilter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (periodFilter) {
      url.searchParams.set('period', periodFilter);
    } else {
      url.searchParams.delete('period');
    }
    router.push(url.pathname + url.search);
  }

  // Summary Widgets calculation
  const totalTaxable = items.reduce((acc, i) => acc + (Number(i.taxableIncome) || 0), 0);
  const totalOwed = items.reduce((acc, i) => acc + (Number(i.taxOwed) || 0), 0);
  const byJurisdiction = items.reduce((acc, i) => {
    const j = i.jurisdiction || 'Unknown';
    if (!acc[j]) acc[j] = { income: 0, owed: 0 };
    acc[j].income += Number(i.taxableIncome) || 0;
    acc[j].owed += Number(i.taxOwed) || 0;
    return acc;
  }, {} as Record<string, { income: number, owed: number }>);

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

  return (
    <EntityListShell
      title="Tax filing"
      subtitle="Track taxable income and amounts owed across every jurisdiction."
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={Download} onClick={handleExport}>
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
              <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid gap-4">
                  <Field label="Tax period" required={!OPTIONAL_FIELDS.includes('taxPeriod')}>
                    <Input
                      name="taxPeriod"
                      defaultValue={editingItem?.taxPeriod ?? ''}
                    />
                  </Field>
                  <Field label="Jurisdiction" required={!OPTIONAL_FIELDS.includes('jurisdiction')}>
                    <Input
                      name="jurisdiction"
                      defaultValue={editingItem?.jurisdiction ?? ''}
                    />
                  </Field>
                  <Field label="Taxable income" required={!OPTIONAL_FIELDS.includes('taxableIncome')}>
                    <Input
                      name="taxableIncome"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.taxableIncome ?? ''}
                    />
                  </Field>
                  <Field label="Tax owed" required={!OPTIONAL_FIELDS.includes('taxOwed')}>
                    <Input
                      name="taxOwed"
                      type="number"
                      step="any"
                      defaultValue={editingItem?.taxOwed ?? ''}
                    />
                  </Field>
                  <Field label="Is filed" required={!OPTIONAL_FIELDS.includes('isFiled')}>
                    <Input
                      name="isFiled"
                      defaultValue={editingItem ? String(editingItem.isFiled ?? '') : ''}
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
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Summary widgets */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard label="Total taxable income" value={fmtINR(totalTaxable)} icon={Wallet} accent="#2563eb" />
        <StatCard label="Total tax owed" value={fmtINR(totalOwed)} icon={Coins} accent="#d97706" />
        <Card variant="outlined" padding="md" className="max-h-[120px] overflow-y-auto">
          <CardHeader>
            <CardTitle>By jurisdiction</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-1">
              {Object.entries(byJurisdiction).map(([j, vals]: [string, any]) => (
                <div key={j} className="flex justify-between text-sm">
                  <span>{j}</span>
                  <span className="font-semibold">{fmtINR(vals.owed)}</span>
                </div>
              ))}
              {Object.keys(byJurisdiction).length === 0 && (
                <div className="text-sm text-[var(--st-text-secondary)]">No data</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-end gap-4 justify-between">
        <Field label="Search records" className="flex-1 w-full max-w-sm">
          <Input
            placeholder="Search records..."
            iconLeft={Search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Field>

        <form onSubmit={handleFilter} className="flex items-end gap-2 w-full sm:w-auto">
          <Field label="Filter by period" className="w-full sm:w-[200px]">
            <Input
              placeholder="e.g. 2024"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      </div>

      <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Tax period</Th>
              <Th>Jurisdiction</Th>
              <Th align="right">Taxable income</Th>
              <Th align="right">Tax owed</Th>
              <Th>Filing status</Th>
              <Th width={80} align="right"><span className="sr-only">Actions</span></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={6}>
                  <EmptyState
                    icon={Receipt}
                    title="No tax records"
                    description="No results match your search. Create a record to get started."
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">{String(item.taxPeriod ?? '—')}</Td>
                  <Td>{String(item.jurisdiction ?? '—')}</Td>
                  <Td align="right" className="tabular-nums">{fmtINR(item.taxableIncome)}</Td>
                  <Td align="right" className="tabular-nums">{fmtINR(item.taxOwed)}</Td>
                  <Td>
                    {(() => {
                      const filed = item.isFiled === true || String(item.isFiled ?? '').toLowerCase() === 'true' || String(item.isFiled ?? '').toLowerCase() === 'filed';
                      return (
                        <Badge tone={filed ? 'success' : 'warning'} dot>
                          {filed ? 'Filed' : 'Pending'}
                        </Badge>
                      );
                    })()}
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
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b border-[var(--st-border)] pb-2">
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
