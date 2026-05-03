'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Repeat,
  Trash2,
  ArrowLeft,
  Save,
  LoaderCircle,
} from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveRecurringInvoice } from '@/app/actions/worksuite/billing.actions';

type LineRow = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
};

const initial = { message: '', error: '' } as {
  message?: string;
  error?: string;
  id?: string;
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

export default function NewRecurringInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(
    saveRecurringInvoice,
    initial,
  );

  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [frequency, setFrequency] = useState<'days' | 'weeks' | 'months' | 'years'>(
    'months',
  );
  const [frequencyCount, setFrequencyCount] = useState(1);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [untilDate, setUntilDate] = useState<string>('');
  const [stopAtCount, setStopAtCount] = useState<string>('');
  const [items, setItems] = useState<LineRow[]>([
    { id: crypto.randomUUID(), name: '', description: '', quantity: 1, unit_price: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/sales/recurring-invoices');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const subtotal = items.reduce(
    (s, it) => s + it.quantity * it.unit_price,
    0,
  );
  const tax = items.reduce(
    (s, it) => s + it.quantity * it.unit_price * ((it.tax_rate || 0) / 100),
    0,
  );
  const total = Math.max(0, subtotal + tax - discount);

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
    items.map(({ id, ...rest }) => ({ ...rest, total: rest.quantity * rest.unit_price })),
  );

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <input type="hidden" name="client_name" value={clientName} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="frequency_count" value={String(frequencyCount)} />
      <input type="hidden" name="recurring_start_date" value={startDate} />
      <input type="hidden" name="next_issue_date" value={startDate} />
      <input type="hidden" name="until_date" value={untilDate} />
      <input type="hidden" name="stop_at_count" value={stopAtCount} />
      <input type="hidden" name="items" value={hiddenItems} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="discount" value={String(discount)} />
      <input type="hidden" name="status" value="active" />

      <CrmPageHeader
        title="New Recurring Invoice"
        subtitle="Create a template that bills on a schedule."
        icon={Repeat}
        actions={
          <>
            <Link href="/dashboard/crm/sales/recurring-invoices">
              <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
                Back
              </ClayButton>
            </Link>
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )
              }
            >
              Save
            </ClayButton>
          </>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-foreground">Client</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Every</Label>
            <Input
              type="number"
              min={1}
              value={frequencyCount}
              onChange={(e) => setFrequencyCount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="years">Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Until Date (optional)</Label>
            <Input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Stop after N invoices (optional)</Label>
            <Input
              type="number"
              min={0}
              value={stopAtCount}
              onChange={(e) => setStopAtCount(e.target.value)}
            />
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Items</h2>
          <ClayButton
            type="button"
            variant="pill"
            size="sm"
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
                <th className="p-2 text-right font-medium text-foreground">Unit</th>
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
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.id, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="w-20 text-right"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.id, { quantity: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-28 text-right"
                      value={row.unit_price}
                      onChange={(e) =>
                        updateRow(row.id, { unit_price: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-20 text-right"
                      value={row.tax_rate || 0}
                      onChange={(e) =>
                        updateRow(row.id, { tax_rate: Number(e.target.value) })
                      }
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
                    className="w-28 text-right"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
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

      <ClayCard>
        <Label className="text-foreground">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </ClayCard>
    </form>
  );
}
