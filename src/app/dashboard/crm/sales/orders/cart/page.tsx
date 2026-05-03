'use client';

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
  ShoppingBag,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Eraser,
  Send,
  LoaderCircle,
} from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Order Cart"
        subtitle="Build a draft order before submitting."
        icon={ShoppingBag}
        actions={
          <Link href="/dashboard/crm/sales/orders">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Back to orders
            </ClayButton>
          </Link>
        }
      />

      <form action={saveAction}>
        <input type="hidden" name="client_name" value={clientName} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="notes" value={notes} />
        <input type="hidden" name="discount" value={String(discount)} />
        <input type="hidden" name="items" value={hiddenItems} />

        <ClayCard>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-foreground">Client</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Currency</Label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>
          </div>
        </ClayCard>

        <ClayCard className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Items</h2>
            <ClayButton
              type="button"
              size="sm"
              variant="pill"
              onClick={addRow}
              leading={<Plus className="h-3.5 w-3.5" />}
            >
              Add line
            </ClayButton>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium text-foreground">Item</th>
                  <th className="p-2 font-medium text-foreground">Description</th>
                  <th className="p-2 text-right font-medium text-foreground">Qty</th>
                  <th className="p-2 text-right font-medium text-foreground">Unit price</th>
                  <th className="p-2 text-right font-medium text-foreground">Tax %</th>
                  <th className="p-2 text-right font-medium text-foreground">Amount</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border">
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
                        className="text-destructive"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary">
                  <td colSpan={5} className="p-3 text-right text-muted-foreground">
                    Subtotal
                  </td>
                  <td className="p-3 text-right font-medium">
                    {fmtMoney(subtotal, currency)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="p-3 text-right text-muted-foreground">
                    Tax
                  </td>
                  <td className="p-3 text-right font-medium">
                    {fmtMoney(tax, currency)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={5} className="p-3 text-right text-muted-foreground">
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
                <tr className="bg-secondary">
                  <td
                    colSpan={5}
                    className="p-3 text-right font-semibold text-foreground"
                  >
                    Total
                  </td>
                  <td className="p-3 text-right font-semibold text-foreground">
                    {fmtMoney(total, currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </ClayCard>

        <ClayCard className="mt-6">
          <Label className="text-foreground">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions..."
            rows={3}
          />
        </ClayCard>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <ClayButton
            type="button"
            variant="pill"
            onClick={handleClear}
            disabled={isClearing}
            leading={<Eraser className="h-4 w-4" />}
          >
            Clear cart
          </ClayButton>
          <ClayButton
            type="submit"
            variant="pill"
            disabled={isSaving}
            leading={
              isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )
            }
          >
            Save draft
          </ClayButton>
          <ClayButton
            type="button"
            variant="obsidian"
            onClick={handleSubmit}
            disabled={isSubmitting}
            leading={
              isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )
            }
          >
            Submit order
          </ClayButton>
        </div>
      </form>
    </div>
  );
}
