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
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Badge,
  Progress,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Mail, Phone, Building2, Store, Download } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createVendor, updateVendor, deleteVendor, Vendor } from '@/app/actions/finance/vendor-portal.actions';

export function VendorListClient({ initialItems, error }: { initialItems: Vendor[], error?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  const editingItem = editingId ? items.find(i => i._id === editingId) : undefined;

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
    link.download = 'vendor-portal_export.csv';
    link.click();
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
        const res = await updateVendor(editingId, data);
        if (res.success) {
          toast.success('Updated successfully');
          setIsDialogOpen(false);
          router.refresh();
        } else throw new Error(res.error);
      } else {
        const res = await createVendor(data);
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
      const res = await deleteVendor(id);
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
    setStatus('ACTIVE');
    setIsDialogOpen(true);
  }

  function openEdit(item: Vendor) {
    setEditingId(item._id as string);
    setStatus((item.onboardingStatus as string) || 'ACTIVE');
    setIsDialogOpen(true);
  }

  return (
    <EntityListShell
      title="Vendor Portal"
      subtitle="A portal for vendors to see their invoices and POs."
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
              <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                <div className="grid gap-4">
                  <Field label="Vendor Name" required>
                    <Input
                      name="name"
                      defaultValue={editingItem?.name ?? ''}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Contact Email" required>
                      <Input
                        name="contactEmail"
                        type="email"
                        defaultValue={editingItem?.contactEmail ?? ''}
                        required
                      />
                    </Field>
                    <Field label="Contact Phone">
                      <Input
                        name="contactPhone"
                        type="tel"
                        defaultValue={editingItem?.contactPhone ?? ''}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Payment Terms">
                      <Input
                        name="paymentTerms"
                        placeholder="e.g. NET_30"
                        defaultValue={editingItem?.paymentTerms ?? ''}
                      />
                    </Field>
                    <Field label="Active Contracts">
                      <Input
                        name="activeContracts"
                        type="number"
                        min="0"
                        defaultValue={editingItem?.activeContracts ?? '0'}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Performance Score (0-100)">
                      <Input
                        name="performanceScore"
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={editingItem?.performanceScore ?? '0'}
                      />
                    </Field>
                    <Field label="Status">
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger aria-label="Status">
                          <SelectValue placeholder="Pick a status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="ONBOARDING">Onboarding</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="onboardingStatus" value={status} />
                    </Field>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" variant="primary" loading={loading} disabled={loading}>
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
        <div className="mb-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-sm text-[var(--st-text)]">
          {error}
        </div>
      )}

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
              <Th>Vendor</Th>
              <Th>Directory Contact</Th>
              <Th>Performance</Th>
              <Th>Terms &amp; Contracts</Th>
              <Th>Status</Th>
              <Th width={80}></Th>
            </Tr>
          </THead>
          <TBody>
            {filteredItems.length === 0 ? (
              <Tr>
                <Td colSpan={6} className="p-8">
                  <EmptyState
                    icon={Store}
                    title="No vendors found"
                    description="Get started by creating a new vendor record."
                    action={
                      <Button variant="primary" size="sm" iconLeft={Plus} onClick={openNew}>
                        Add Vendor
                      </Button>
                    }
                  />
                </Td>
              </Tr>
            ) : (
              filteredItems.map((item) => (
                <Tr key={item._id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                        <Building2 className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
                      </div>
                      <span className="font-medium text-[var(--st-text)]">{String(item.name ?? 'Unknown')}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-sm">
                      {item.contactEmail && (
                        <div className="flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                          <Mail className="h-3 w-3" aria-hidden="true" />
                          <a href={`mailto:${item.contactEmail}`} className="text-[var(--st-text)] hover:underline">{item.contactEmail}</a>
                        </div>
                      )}
                      {item.contactPhone && (
                        <div className="flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                          <Phone className="h-3 w-3" aria-hidden="true" />
                          <a href={`tel:${item.contactPhone}`} className="hover:underline">{item.contactPhone}</a>
                        </div>
                      )}
                      {!item.contactEmail && !item.contactPhone && <span className="italic text-[var(--st-text-secondary)]">No contact info</span>}
                    </div>
                  </Td>
                  <Td width={200}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--st-text-secondary)]">Score</span>
                        <span className="font-medium text-[var(--st-text)]">{item.performanceScore || 0}/100</span>
                      </div>
                      <Progress value={Number(item.performanceScore || 0)} size="sm" aria-label="Performance score" />
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="text-[var(--st-text)]">Terms: <span className="font-medium">{item.paymentTerms || 'N/A'}</span></div>
                      <div className="text-[var(--st-text-secondary)]">{item.activeContracts || 0} active contracts</div>
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      tone={item.onboardingStatus === 'ACTIVE' ? 'success' : item.onboardingStatus === 'INACTIVE' ? 'danger' : 'neutral'}
                    >
                      {item.onboardingStatus || 'ACTIVE'}
                    </Badge>
                  </Td>
                  <Td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label="Open actions" icon={MoreHorizontal} variant="ghost" size="sm" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem iconLeft={Pencil} onClick={() => openEdit(item)}>
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
    </EntityListShell>
  );
}
