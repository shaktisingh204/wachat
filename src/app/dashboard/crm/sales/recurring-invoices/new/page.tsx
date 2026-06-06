'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Save,
  LoaderCircle,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import type { LookupItem } from '@/lib/lookup-registry';
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
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(
    saveRecurringInvoice,
    initial,
  );

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
    <EntityDetailShell
      eyebrow="RECURRING INVOICE"
      title="New Recurring Invoice"
      back={{ href: '/dashboard/crm/sales/recurring-invoices', label: 'Recurring Invoices' }}
      actions={
        <Button type="submit" form="new-recurring-invoice-form" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      }
    >
    <form id="new-recurring-invoice-form" action={formAction} className="flex w-full flex-col gap-6">
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

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-zoru-ink">Client</Label>
            <EntityFormField
              entity="client"
              name="client_id"
              dualWriteName="client_name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Currency</Label>
            <EntityFormField
              entity="currency"
              name="currency"
              initialId={currency}
              onChange={(id) => setCurrency(id || 'INR')}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Every</Label>
            <Input
              type="number"
              min={1}
              value={frequencyCount}
              onChange={(e) => setFrequencyCount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Frequency</Label>
            <EnumFormField
              enumName="recurringInvoiceFrequency"
              name="__frequency_picker"
              initialId={frequency}
              onChange={(v) => setFrequency((v ?? 'months') as 'days' | 'weeks' | 'months' | 'years')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Until Date (optional)</Label>
            <Input
              type="date"
              value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zoru-ink">Stop after N invoices (optional)</Label>
            <Input
              type="number"
              min={0}
              value={stopAtCount}
              onChange={(e) => setStopAtCount(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] text-zoru-ink">Items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
                <th className="p-2 text-right text-zoru-ink">Unit</th>
                <th className="p-2 text-right text-zoru-ink">Tax %</th>
                <th className="p-2 text-right text-zoru-ink">Amount</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-zoru-line">
                  <td className="p-2 min-w-[200px]">
                    <EntityPicker
                      entity="item"
                      value={null}
                      placeholder="Pick item or type name"
                      onChange={(_id, hydrated) => {
                        const h = (Array.isArray(hydrated) ? hydrated[0] : hydrated) as LookupItem | undefined;
                        const raw = (h?.raw ?? {}) as Record<string, unknown>;
                        const name = typeof raw.name === 'string' ? raw.name : (h?.chip.primary ?? '');
                        const desc = typeof raw.description === 'string' ? raw.description : undefined;
                        const price = typeof raw.sellingPrice === 'number' ? raw.sellingPrice : undefined;
                        updateRow(row.id, {
                          name,
                          ...(desc != null ? { description: desc } : {}),
                          ...(price != null ? { unit_price: price } : {}),
                        });
                      }}
                    />
                    {row.name ? (
                      <p className="mt-1 text-[11px] text-zoru-ink-muted">{row.name}</p>
                    ) : null}
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
                    className="w-28 text-right"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
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

      <Card className="p-6">
        <Label className="text-zoru-ink">Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </Card>
    </form>
    </EntityDetailShell>
  );
}
