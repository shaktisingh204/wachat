'use client';

import { Button, Card, Input, Label, Skeleton, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState,
  } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Save,
  Eraser,
  Send,
  LoaderCircle,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCart,
  saveCart,
  submitCart,
  clearCart,
} from '@/app/actions/worksuite/billing.actions';
import type { WsOrder, WsOrderItem } from '@/lib/worksuite/billing-types';

type LineRow = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
};

function fmtMoney(n: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).format(n || 0);
  } catch {
    return `${currency} ${n || 0}`;
  }
}

const initialState = { message: '', error: '' } as {
  message?: string;
  error?: string;
  id?: string;
};

export default function CartPage() {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [isLoading, startLoading] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();
  const [isClearing, startClearing] = useTransition();

  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [items, setItems] = useState<LineRow[]>([
    { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unit_price: 0 },
  ]);

  const [saveState, saveAction, isSaving] = useActionState(saveCart, initialState);

  const load = useCallback(() => {
    startLoading(async () => {
      const cart = (await getCart()) as (WsOrder & { _id: string }) | null;
      if (cart) {
        setClientName(cart.client_name || '');
        setCurrency(cart.currency || 'INR');
        setNotes(cart.notes || '');
        setDiscount(cart.discount || 0);
        const rows = (cart.items || []).map((it: WsOrderItem) => ({
          id: crypto.randomUUID(),
          name: it.name || '',
          description: it.description || '',
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0,
          tax_rate: it.tax_rate,
        }));
        if (rows.length) setItems(rows);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Cart saved', description: saveState.message });
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast]);

  const subtotal = items.reduce(
    (s, it) => s + (it.quantity || 0) * (it.unit_price || 0),
    0,
  );
  const tax = items.reduce(
    (s, it) => s + (it.quantity || 0) * (it.unit_price || 0) * ((it.tax_rate || 0) / 100),
    0,
  );
  const total = Math.max(0, subtotal + tax - (discount || 0));

  const addRow = () =>
    setItems((rows) => [
      ...rows,
      { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unit_price: 0 },
    ]);
  const removeRow = (id: string) =>
    setItems((rows) => rows.filter((r) => r.id !== id));
  const updateRow = (id: string, patch: Partial<LineRow>) =>
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const hiddenItems = JSON.stringify(
    items.map(({ id, ...rest }) => ({
      ...rest,
      total: rest.quantity * rest.unit_price,
    })),
  );

  const handleSubmit = () => {
    startSubmitting(async () => {
      const res = await submitCart();
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Order submitted', description: res.message });
      if (res.id) router.push(`/dashboard/crm/sales/orders/${res.id}`);
    });
  };

  const handleClear = () => {
    if (!confirm('Clear the cart?')) return;
    startClearing(async () => {
      await clearCart();
      setItems([
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          quantity: 1,
          unit_price: 0,
        },
      ]);
      setClientName('');
      setNotes('');
      setDiscount(0);
      toast({ title: 'Cart cleared' });
    });
  };

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <EntityListShell
      title="Order Cart"
      subtitle="Build a draft order before submitting."
    >
      <form action={saveAction}>
        <input type="hidden" name="client_name" value={clientName} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="discount" value={String(discount)} />
        <input type="hidden" name="items" value={hiddenItems} />

        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-zoru-ink">Client</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zoru-ink">Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">Items</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-sm">
              <thead className="bg-zoru-surface-2">
                <tr className="border-b border-zoru-line text-left">
                  <th className="p-2 text-zoru-ink">Item</th>
                  <th className="p-2 text-zoru-ink">Description</th>
                  <th className="p-2 text-right text-zoru-ink">Qty</th>
                  <th className="p-2 text-right text-zoru-ink">Unit price</th>
                  <th className="p-2 text-right text-zoru-ink">Tax %</th>
                  <th className="p-2 text-right text-zoru-ink">Amount</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-zoru-line">
                    <td className="p-2">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Name"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={row.description}
                        onChange={(e) =>
                          updateRow(row.id, { description: e.target.value })
                        }
                        placeholder="Description"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={row.quantity}
                        onChange={(e) =>
                          updateRow(row.id, { quantity: Number(e.target.value) })
                        }
                        className="w-20 text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.unit_price}
                        onChange={(e) =>
                          updateRow(row.id, { unit_price: Number(e.target.value) })
                        }
                        className="w-28 text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={row.tax_rate || 0}
                        onChange={(e) =>
                          updateRow(row.id, { tax_rate: Number(e.target.value) })
                        }
                        className="w-20 text-right"
                      />
                    </td>
                    <td className="p-2 text-right">
                      {fmtMoney(row.quantity * row.unit_price, currency)}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-zoru-danger-ink"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-zoru-surface-2">
                  <td colSpan={5} className="p-3 text-right text-zoru-ink-muted">
                    Subtotal
                  </td>
                  <td className="p-3 text-right">
                    {fmtMoney(subtotal, currency)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="p-3 text-right text-zoru-ink-muted">
                    Tax
                  </td>
                  <td className="p-3 text-right">
                    {fmtMoney(tax, currency)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="p-3 text-right text-zoru-ink-muted">
                    Discount
                  </td>
                  <td className="p-3 text-right">
                    <Input
                      type="number"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-28 text-right"
                    />
                  </td>
                  <td />
                </tr>
                <tr className="bg-zoru-surface-2">
                  <td
                    colSpan={5}
                    className="p-3 text-right text-zoru-ink"
                  >
                    Total
                  </td>
                  <td className="p-3 text-right text-zoru-ink">
                    {fmtMoney(total, currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <Label className="text-zoru-ink">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions..."
            rows={3}
          />
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isClearing}
          >
            <Eraser className="h-4 w-4" />
            Clear cart
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSaving}
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit order
          </Button>
        </div>
      </form>
    </EntityListShell>
  );
}
