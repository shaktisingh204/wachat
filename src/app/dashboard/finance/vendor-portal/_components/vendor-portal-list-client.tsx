"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Button, 
  Input, 
  Label, 
  Table, 
  ZoruTableBody, 
  ZoruTableCell, 
  ZoruTableHead, 
  ZoruTableHeader, 
  ZoruTableRow,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Badge,
  Progress,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import { Plus, MoreHorizontal, Pencil, Trash, Search, Mail, Phone, Building2, Store, Download, Eye } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { createVendor, updateVendor, deleteVendor, Vendor } from '@/app/actions/finance/vendor-portal.actions';
import { toast } from 'sonner';

export function VendorListClient({ initialItems, error }: { initialItems: Vendor[], error?: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<Vendor | null>(null);

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

  function openView(item: Vendor) {
    setViewingItem(item);
    setIsViewOpen(true);
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
    setIsDialogOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setIsDialogOpen(true);
  }

  return (
    <EntityListShell
      title="Vendor Portal"
      subtitle="A portal for vendors to see their invoices and POs."
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <ZoruDialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New Record
            </Button>
          </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>{editingId ? 'Edit' : 'Create'} Record</ZoruDialogTitle>
            </ZoruDialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Vendor Name</Label>
              <Input 
                name="name" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.name : ''} 
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input 
                  name="contactEmail" 
                  type="email"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.contactEmail : ''} 
                  required 
                />
              </div>
              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input 
                  name="contactPhone" 
                  type="tel"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.contactPhone : ''} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Payment Terms</Label>
                <Input 
                  name="paymentTerms" 
                  placeholder="e.g. NET_30"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.paymentTerms : ''} 
                />
              </div>
              <div className="space-y-1">
                <Label>Active Contracts</Label>
                <Input 
                  name="activeContracts" 
                  type="number"
                  min="0"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.activeContracts : '0'} 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Performance Score (0-100)</Label>
                <Input 
                  name="performanceScore" 
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.performanceScore : '0'} 
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select 
                  name="onboardingStatus"
                  className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-sm ring-offset-zoru-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue={editingId ? items.find(i => i._id === editingId)?.onboardingStatus : 'ACTIVE'}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div></div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </ZoruDialogContent>
        </Dialog>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-4 text-sm text-zoru-ink">
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
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
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead>Vendor</ZoruTableHead><ZoruTableHead>Directory Contact</ZoruTableHead><ZoruTableHead>Performance</ZoruTableHead><ZoruTableHead>Terms & Contracts</ZoruTableHead><ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="w-[80px]"></ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredItems.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6} className="p-8">
                  <EmptyState 
                    icon={<Store className="h-6 w-6" />}
                    title="No vendors found"
                    description="Get started by creating a new vendor record."
                    action={
                      <Button onClick={openNew} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Vendor
                      </Button>
                    }
                  />
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filteredItems.map((item) => (
                <ZoruTableRow key={item._id}>
                  <ZoruTableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-zoru-ink/10">
                        <Building2 className="h-4 w-4 text-zoru-ink" />
                      </div>
                      <span className="font-medium">{String(item.name ?? 'Unknown')}</span>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {item.contactEmail && (
                        <div className="flex items-center gap-1.5 text-zoru-ink-muted">
                          <Mail className="h-3 w-3" />
                          <a href={`mailto:${item.contactEmail}`} className="hover:underline text-zoru-ink">{item.contactEmail}</a>
                        </div>
                      )}
                      {item.contactPhone && (
                        <div className="flex items-center gap-1.5 text-zoru-ink-muted">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${item.contactPhone}`} className="hover:underline">{item.contactPhone}</a>
                        </div>
                      )}
                      {!item.contactEmail && !item.contactPhone && <span className="text-zoru-ink-muted italic">No contact info</span>}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="w-[200px]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zoru-ink-muted">Score</span>
                        <span className="font-medium">{item.performanceScore || 0}/100</span>
                      </div>
                      <Progress value={Number(item.performanceScore || 0)} className="h-1.5" />
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <div>Terms: <span className="font-medium">{item.paymentTerms || 'N/A'}</span></div>
                      <div className="text-zoru-ink-muted">{item.activeContracts || 0} active contracts</div>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={item.onboardingStatus === 'ACTIVE' ? 'default' : item.onboardingStatus === 'INACTIVE' ? 'destructive' : 'secondary'}>
                      {item.onboardingStatus || 'ACTIVE'}
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={() => openEdit(item._id as string)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem className="text-zoru-ink focus:bg-zoru-surface-2" onClick={() => handleDelete(item._id as string)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </Table>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>View Details</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            {viewingItem && Object.entries(viewingItem).filter(([k]) => k !== '__v').map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-4 border-b pb-2">
                <div className="font-medium text-sm text-zoru-ink-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="col-span-2 text-sm">{String(value)}</div>
              </div>
            ))}
          </div>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
