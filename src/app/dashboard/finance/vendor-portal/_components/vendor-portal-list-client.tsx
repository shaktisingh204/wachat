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
} from '@/components/zoruui';
import { Plus, MoreHorizontal, Pencil, Trash, Search } from 'lucide-react';
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
              <Label>Name</Label>
              <Input 
                name="name" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.name : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("name")} 
              />
            </div>
            <div className="space-y-1">
              <Label>ContactEmail</Label>
              <Input 
                name="contactEmail" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.contactEmail : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("contactEmail")} 
              />
            </div>
            <div className="space-y-1">
              <Label>PaymentTerms</Label>
              <Input 
                name="paymentTerms" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.paymentTerms : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("paymentTerms")} 
              />
            </div>
            <div className="space-y-1">
              <Label>ActiveContracts</Label>
              <Input 
                name="activeContracts" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.activeContracts : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("activeContracts")} 
              />
            </div>
            <div className="space-y-1">
              <Label>OnboardingStatus</Label>
              <Input 
                name="onboardingStatus" 
                defaultValue={editingId ? items.find(i => i._id === editingId)?.onboardingStatus : ''} 
                required={!['credit', 'debit', 'exchangeRate', 'salvageValue', 'accumulatedDepreciation', 'approvedBy', 'variance', 'status'].includes("onboardingStatus")} 
              />
            </div></div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </ZoruDialogContent>
        </Dialog>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
              <ZoruTableHead>Name</ZoruTableHead><ZoruTableHead>ContactEmail</ZoruTableHead><ZoruTableHead>PaymentTerms</ZoruTableHead><ZoruTableHead>ActiveContracts</ZoruTableHead><ZoruTableHead>OnboardingStatus</ZoruTableHead>
              <ZoruTableHead className="w-[80px]"></ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {filteredItems.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={6} className="h-24 text-center">
                  No results.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              filteredItems.map((item) => (
                <ZoruTableRow key={item._id}>
                  <ZoruTableCell>{String(item.name ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.contactEmail ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.paymentTerms ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.activeContracts ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.onboardingStatus ?? '')}</ZoruTableCell>
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
                        <ZoruDropdownMenuItem className="text-red-600 focus:bg-red-50" onClick={() => handleDelete(item._id as string)}>
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
    </EntityListShell>
  );
}
