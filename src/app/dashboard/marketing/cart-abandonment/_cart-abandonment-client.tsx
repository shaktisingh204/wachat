'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Search, ShoppingCart } from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
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
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createAbandonedCart,
  updateAbandonedCart,
  deleteAbandonedCart,
} from '@/app/actions/marketing/cart-abandonment.actions';

export function AbandonedCartClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form state
  const [userId, setUserId] = useState<any>('');
  const [totalAmount, setTotalAmount] = useState<any>(0);
  const [recovered, setRecovered] = useState<any>(false);

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
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
    const payload = { userId, totalAmount, recovered };

    try {
      if (editingItem) {
        const res = await updateAbandonedCart(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Record updated successfully.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createAbandonedCart(payload);
        if (res.success) {
          // Optimistically reload to pick up the server-generated record.
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

    const res = await deleteAbandonedCart(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Record deleted.');
    } else {
      toast.error(res.error || 'Failed to delete record.');
    }
  };

  return (
    <div className="ui20 flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Abandoned Carts</PageTitle>
          <PageDescription>Manage your abandoned carts seamlessly.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <div className="w-full sm:w-64">
            <Field label="Search carts">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                iconLeft={Search}
              />
            </Field>
          </div>
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
                <Field label="User ID">
                  <Input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </Field>

                <Field label="Total Amount">
                  <Input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                  />
                </Field>

                <Checkbox
                  label="Recovered"
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
        </PageActions>
      </PageHeader>

      {filteredData.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={ShoppingCart}
            title="No records found"
            description="Abandoned carts will appear here once they are recorded."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                Create New
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>User ID</Th>
                <Th>Total Amount</Th>
                <Th>Recovered</Th>
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
                        icon={Pencil}
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
        </Card>
      )}
    </div>
  );
}
