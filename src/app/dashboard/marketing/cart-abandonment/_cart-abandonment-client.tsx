'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  PackageX,
  BadgeCheck,
  Percent,
  Wallet,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
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
  SearchInput,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { fmtINR } from '@/lib/utils';
import {
  createAbandonedCart,
  updateAbandonedCart,
  deleteAbandonedCart,
} from '@/app/actions/marketing/cart-abandonment.actions';

interface CartRecord {
  _id: string;
  userId?: string;
  totalAmount?: number;
  recovered?: boolean;
  [key: string]: unknown;
}

export function AbandonedCartClient({ initialData }: { initialData: CartRecord[] }) {
  const [data, setData] = useState<CartRecord[]>(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CartRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form state
  const [userId, setUserId] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [recovered, setRecovered] = useState(false);

  const filteredData = useMemo(
    () =>
      data.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
      ),
    [data, search],
  );

  const stats = useMemo(() => {
    const total = data.length;
    const recoveredCount = data.filter((c) => c.recovered).length;
    const recoveredValue = data
      .filter((c) => c.recovered)
      .reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
    const atRiskValue = data
      .filter((c) => !c.recovered)
      .reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
    const rate = total > 0 ? (recoveredCount / total) * 100 : 0;
    return { total, recoveredCount, recoveredValue, atRiskValue, rate };
  }, [data]);

  const openNew = () => {
    setEditingItem(null);
    setUserId('');
    setTotalAmount(0);
    setRecovered(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: CartRecord) => {
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
          toast.success('Cart updated.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Could not update the cart.');
        }
      } else {
        const res = await createAbandonedCart(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast.error(res.error || 'Could not create the cart.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this abandoned cart record?')) return;

    const res = await deleteAbandonedCart(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Cart deleted.');
    } else {
      toast.error(res.error || 'Could not delete the cart.');
    }
  };

  const dialog = (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" iconLeft={Plus} onClick={openNew}>
          Record cart
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit cart' : 'Record abandoned cart'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Field label="Customer ID">
            <Input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="cust_8421"
            />
          </Field>
          <Field label="Cart value" help="Total order value left in the cart.">
            <Input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              prefix="₹"
            />
          </Field>
          <Checkbox
            label="Marked as recovered"
            checked={recovered}
            onChange={(e) => setRecovered(e.currentTarget.checked)}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>
            Save cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Cart abandonment</PageTitle>
          <PageDescription>
            Track carts customers left behind and follow the value you recover back into revenue.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{dialog}</PageActions>
      </PageHeader>

      <section aria-label="Recovery overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Abandoned carts" value={stats.total.toLocaleString()} icon={ShoppingCart} accent="#3b7af5" />
        <StatCard
          label="Recovered"
          value={stats.recoveredCount.toLocaleString()}
          icon={BadgeCheck}
          accent="#1f9d55"
        />
        <StatCard
          label="Recovery rate"
          value={`${stats.rate.toFixed(1)}%`}
          icon={Percent}
          accent="#7c3aed"
        />
        <StatCard label="Value at risk" value={fmtINR(stats.atRiskValue)} icon={Wallet} accent="#e0484e" />
      </section>

      <Card padding="none">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
          <div>
            <CardTitle>Abandoned carts</CardTitle>
            <CardDescription>{filteredData.length} of {data.length} carts</CardDescription>
          </div>
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by customer or value"
              aria-label="Search abandoned carts"
            />
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={search ? PackageX : ShoppingCart}
              title={search ? 'No carts match your search' : 'No abandoned carts yet'}
              description={
                search
                  ? 'Try a different customer ID or value.'
                  : 'Abandoned carts appear here as customers leave items behind.'
              }
              action={
                search ? undefined : (
                  <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                    Record cart
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Customer</Th>
                <Th align="right">Cart value</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">{String(item.userId || 'Unknown')}</Td>
                  <Td align="right" className="tabular-nums">
                    {fmtINR(Number(item.totalAmount) || 0)}
                  </Td>
                  <Td>
                    <Badge tone={item.recovered ? 'success' : 'warning'} dot>
                      {item.recovered ? 'Recovered' : 'Open'}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit cart"
                        icon={Pencil}
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete cart"
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
        )}
      </Card>
    </div>
  );
}
