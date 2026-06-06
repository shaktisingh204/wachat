'use client';

import React, { useState } from 'react';
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
  Checkbox,
  Badge,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { Plus, Edit2, Trash2, ShoppingCart } from 'lucide-react';
import { createAbandonedCart, updateAbandonedCart, deleteAbandonedCart } from '@/app/actions/marketing/cart-abandonment.actions';

export function AbandonedCartClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form State
  const [userId, setUserId] = useState<any>('');
  const [totalAmount, setTotalAmount] = useState<any>(0);
  const [recovered, setRecovered] = useState<any>(false);

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingItem(null);
    setUserId('');
    setTotalAmount(0);
    setRecovered(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setUserId(item.userId || '');
    setTotalAmount(item.totalAmount || 0);
    setRecovered(item.recovered || false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      userId,
      totalAmount,
      recovered,
    };

    try {
      if (editingItem) {
        const res = await updateAbandonedCart(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast.error({ title: 'Error', description: res.error || 'Failed to update record.' });
        }
      } else {
        const res = await createAbandonedCart(payload);
        if (res.success) {
          // Optimistically reload page or add
          window.location.reload();
        } else {
          toast.error({ title: 'Error', description: res.error || 'Failed to create record.' });
        }
      }
    } catch (err) {
      toast.error({ title: 'Error', description: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const res = await deleteAbandonedCart(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast.error({ title: 'Error', description: res.error || 'Failed to delete record.' });
    }
  };

  return (
    <EntityListShell
      title="Abandoned Carts"
      subtitle="Manage your Abandoned Carts seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
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
              <Field label="userId">
                <Input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </Field>

              <Field label="totalAmount">
                <Input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                />
              </Field>

              <Checkbox
                label="recovered"
                checked={recovered}
                onChange={(e) => setRecovered(e.target.checked)}
              />
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
      {filteredData.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No records found"
          description="There are no abandoned carts to show. New records will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
          <Table>
            <THead>
              <Tr>
                <Th className="capitalize">userId</Th>
                <Th className="capitalize">totalAmount</Th>
                <Th className="capitalize">recovered</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.userId || '')}</Td>
                  <Td>{String(item.totalAmount || '')}</Td>
                  <Td>
                    <Badge tone={item.recovered ? 'success' : 'neutral'} dot>
                      {item.recovered ? 'Yes' : 'No'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit record"
                        icon={Edit2}
                        variant="ghost"
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete record"
                        icon={Trash2}
                        variant="ghost"
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
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
