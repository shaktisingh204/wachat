'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Label } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { createAudienceSegment, updateAudienceSegment, deleteAudienceSegment } from '@/app/actions/marketing/audience-segmentation.actions';

export function AudienceSegmentClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  
  // Form State
  const [name, setName] = useState<any>("");

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingItem(null);
    setName("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name
    };

    try {
      if (editingItem) {
        const res = await updateAudienceSegment(editingItem._id, payload);
        if (res.success) {
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createAudienceSegment(payload);
        if (res.success) {
          // Optimistically reload page or add
          window.location.reload();
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to create record.', variant: 'destructive' });
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    const res = await deleteAudienceSegment(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="Audience Segmentation"
      subtitle="Manage your Audience Segmentation seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">name</Label>
                  
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
            </div>
            <DialogFooter>
              <Button disabled={loading} onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {filteredData.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-[var(--st-text-secondary)]">
          No records found.
        </div>
      ) : (
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th className="capitalize">name</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  
                    <Td>
                      {String(item.name || '')}
                    </Td>
                  
                  <Td className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Edit2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                      <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </EntityListShell>
  );
}
