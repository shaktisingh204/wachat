'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createAudienceSegment,
  updateAudienceSegment,
  deleteAudienceSegment,
} from '@/app/actions/marketing/audience-segmentation.actions';

export function AudienceSegmentClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState<any>('');

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditingItem(null);
    setName('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = { name };

    try {
      if (editingItem) {
        const res = await updateAudienceSegment(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Record updated successfully.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createAudienceSegment(payload);
        if (res.success) {
          // Optimistically reload the page so the new record appears.
          window.location.reload();
        } else {
          toast.error(res.error || 'Failed to create record.');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const res = await deleteAudienceSegment(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Record deleted.');
    } else {
      toast.error(res.error || 'Failed to delete record.');
    }
  };

  return (
    <EntityListShell
      title="Audience Segmentation"
      subtitle="Manage your audience segments seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      empty={
        filteredData.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No records found"
            description="No audience segments match your search. Create one to get started."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                Create New
              </Button>
            }
          />
        ) : undefined
      }
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" iconLeft={Plus} onClick={openNew}>
              Create New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Field label="Name">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="primary" loading={loading} onClick={handleSave}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {filteredData.map((item) => (
              <Tr key={item._id}>
                <Td>{String(item.name || '')}</Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      label="Edit record"
                      icon={Pencil}
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(item)}
                    />
                    <IconButton
                      label="Delete record"
                      icon={Trash2}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item._id)}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </EntityListShell>
  );
}
