'use client';

/**
 * InvoiceEditorClient — the shared draft-invoice editor behind both
 * `/sabpay/invoices/new` (no `initial`) and `/sabpay/invoices/[id]` while the
 * invoice is still a draft (`initial` set). Customer comes from the merchant's
 * customer book (Combobox) or raw name/email/phone; line items are edited in a
 * live-totalling table (rupees in, paise out). "Save draft" persists; "Save &
 * issue" persists then issues, producing the payable link.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Combobox,
  DatePicker,
  Field,
  IconButton,
  Input,
  SegmentedControl,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import type {
  SabpayCreateInvoiceBody,
  SabpayInvoiceLineItemInput,
} from '@/lib/rust-client/sabpay';
import {
  formatSabpayAmount,
  type SabpayCustomer,
  type SabpayInvoice,
  type SabpayMode,
} from '@/lib/sabpay/types';

import {
  createSabpayInvoice,
  issueSabpayInvoice,
  updateSabpayInvoice,
} from '../actions/invoices';

type CustomerSource = 'existing' | 'new';

const CUSTOMER_SOURCES: Array<{ value: CustomerSource; label: string }> = [
  { value: 'existing', label: 'Existing customer' },
  { value: 'new', label: 'New details' },
];

interface LineItemDraft {
  key: number;
  /** The visible "Description" column — maps to the API's required `name`. */
  name: string;
  /** Secondary description carried through from `initial`, never edited here. */
  description?: string;
  qty: string;
  unitRupees: string;
}

export interface InvoiceEditorClientProps {
  mode: SabpayMode;
  customers: SabpayCustomer[];
  /** Present when editing an existing draft; absent on /invoices/new. */
  initial?: SabpayInvoice;
}

/** Paise total of one row; rows that don't parse yet count as 0. */
function lineTotalPaise(item: LineItemDraft): number {
  const rupees = Number.parseFloat(item.unitRupees);
  const qty = Math.floor(Number(item.qty));
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  if (!Number.isInteger(qty) || qty < 1) return 0;
  return Math.round(rupees * 100) * qty;
}

export function InvoiceEditorClient({
  mode,
  customers,
  initial,
}: InvoiceEditorClientProps): React.JSX.Element {
  const router = useRouter();
  const keyRef = React.useRef(0);
  const nextKey = () => ++keyRef.current;

  const [customerSource, setCustomerSource] = React.useState<CustomerSource>(() => {
    if (initial?.customerId) return 'existing';
    if (initial && (initial.customerName || initial.customerEmail || initial.customerPhone)) {
      return 'new';
    }
    return customers.length > 0 ? 'existing' : 'new';
  });
  const [customerId, setCustomerId] = React.useState<string | null>(
    initial?.customerId ?? null,
  );
  const [customerName, setCustomerName] = React.useState(initial?.customerName ?? '');
  const [customerEmail, setCustomerEmail] = React.useState(initial?.customerEmail ?? '');
  const [customerPhone, setCustomerPhone] = React.useState(initial?.customerPhone ?? '');

  const [dueDate, setDueDate] = React.useState<Date | undefined>(
    initial?.expireBy ? new Date(initial.expireBy) : undefined,
  );
  const [note, setNote] = React.useState(
    typeof initial?.notes?.note === 'string' ? initial.notes.note : '',
  );

  const [items, setItems] = React.useState<LineItemDraft[]>(() => {
    if (initial && initial.lineItems.length > 0) {
      return initial.lineItems.map((li) => ({
        key: ++keyRef.current,
        name: li.name,
        description: li.description,
        qty: String(li.quantity),
        unitRupees: String(li.amount / 100),
      }));
    }
    return [{ key: ++keyRef.current, name: '', qty: '1', unitRupees: '' }];
  });

  const [saving, setSaving] = React.useState<'draft' | 'issue' | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const currency = initial?.currency ?? 'INR';
  const totalPaise = items.reduce((sum, item) => sum + lineTotalPaise(item), 0);

  function patchItem(key: number, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { key: nextKey(), name: '', qty: '1', unitRupees: '' }]);
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  function buildBody(): { body: SabpayCreateInvoiceBody } | { error: string } {
    if (items.length === 0) return { error: 'Add at least one line item.' };

    const lineItems: SabpayInvoiceLineItemInput[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) {
        return { error: `Line item ${i + 1} needs a description.` };
      }
      const rupees = Number.parseFloat(item.unitRupees);
      if (!Number.isFinite(rupees) || rupees <= 0) {
        return { error: `Line item ${i + 1} needs a unit amount above ₹0.` };
      }
      const qty = Math.floor(Number(item.qty));
      if (!Number.isInteger(qty) || qty < 1) {
        return { error: `Line item ${i + 1} needs a quantity of at least 1.` };
      }
      lineItems.push({
        name: item.name.trim(),
        description: item.description || undefined,
        amount: Math.round(rupees * 100),
        quantity: qty,
      });
    }

    const useExisting = customerSource === 'existing';
    if (useExisting && customers.length > 0 && !customerId) {
      return { error: 'Pick a customer, or switch to entering their details.' };
    }

    const trimmedNote = note.trim();
    const body: SabpayCreateInvoiceBody = {
      ...(useExisting && customerId
        ? { customerId }
        : {
            customerName: customerName.trim() || undefined,
            customerEmail: customerEmail.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
          }),
      lineItems,
      expireBy: dueDate ? dueDate.toISOString() : undefined,
      notes: trimmedNote
        ? { ...(initial?.notes ?? {}), note: trimmedNote }
        : initial?.notes && Object.keys(initial.notes).length > 0
          ? initial.notes
          : undefined,
    };
    return { body };
  }

  async function save(issue: boolean) {
    const built = buildBody();
    if ('error' in built) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    setSaving(issue ? 'issue' : 'draft');
    try {
      const saved = initial
        ? await updateSabpayInvoice(initial.id, built.body)
        : await createSabpayInvoice(built.body);
      if (saved.error || !saved.invoice) {
        setFormError(saved.error || 'Could not save the invoice.');
        return;
      }

      if (issue) {
        const issued = await issueSabpayInvoice(saved.invoice.id);
        if (issued.error || !issued.invoice) {
          toast({
            title: 'Draft saved, but issuing failed',
            description: issued.error || 'Try issuing it again from the invoice page.',
            tone: 'warning',
          });
        } else {
          toast({
            title: 'Invoice issued',
            description: 'Your customer can now pay it at its payable link.',
            tone: 'success',
          });
        }
      } else {
        toast({ title: 'Draft saved', tone: 'success' });
      }

      router.push(`/sabpay/invoices/${saved.invoice.id}`);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  const mono = { fontFamily: 'var(--st-font-mono, monospace)' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SegmentedControl
              aria-label="Customer source"
              items={CUSTOMER_SOURCES}
              value={customerSource}
              onChange={setCustomerSource}
            />
            {customerSource === 'existing' ? (
              customers.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--st-text-muted)', fontSize: 14 }}>
                  No customers in {mode} mode yet — switch to “New details” to bill
                  someone directly.
                </p>
              ) : (
                <Field label="Customer" required>
                  <Combobox
                    value={customerId}
                    onChange={(value) => setCustomerId(value)}
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: c.email,
                    }))}
                    placeholder="Search customers…"
                    emptyText="No matching customers"
                    aria-label="Customer"
                  />
                </Field>
              )
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <Field label="Name">
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Asha Mehta"
                    maxLength={120}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="asha@example.com"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </Field>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Description</Th>
                <Th style={{ width: 90 }}>Qty</Th>
                <Th style={{ width: 140 }}>Unit amount (₹)</Th>
                <Th style={{ width: 130, textAlign: 'right' }}>Total</Th>
                <Th style={{ width: 44 }} aria-label="Row actions" />
              </Tr>
            </THead>
            <TBody>
              {items.map((item, i) => (
                <Tr key={item.key}>
                  <Td>
                    <Input
                      value={item.name}
                      onChange={(e) => patchItem(item.key, { name: e.target.value })}
                      placeholder="Pro plan, March"
                      maxLength={200}
                      aria-label={`Line item ${i + 1} description`}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={item.qty}
                      onChange={(e) => patchItem(item.key, { qty: e.target.value })}
                      aria-label={`Line item ${i + 1} quantity`}
                    />
                  </Td>
                  <Td>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      inputMode="decimal"
                      value={item.unitRupees}
                      onChange={(e) => patchItem(item.key, { unitRupees: e.target.value })}
                      placeholder="499"
                      aria-label={`Line item ${i + 1} unit amount in rupees`}
                    />
                  </Td>
                  <Td
                    style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                    }}
                  >
                    {formatSabpayAmount(lineTotalPaise(item), currency)}
                  </Td>
                  <Td>
                    <IconButton
                      label={`Remove line item ${i + 1}`}
                      icon={<Trash2 size={14} />}
                      variant="ghost"
                      size="sm"
                      disabled={items.length === 1}
                      onClick={() => removeItem(item.key)}
                    />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              paddingTop: 14,
            }}
          >
            <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={addItem}>
              Add line item
            </Button>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
                fontSize: 14,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'var(--st-text-muted)' }}>
                Subtotal&nbsp;
                <span style={mono}>{formatSabpayAmount(totalPaise, currency)}</span>
              </span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                Total&nbsp;
                <span style={mono}>{formatSabpayAmount(totalPaise, currency)}</span>
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              label="Due date"
              help="Optional. The invoice expires (stops being payable) after this date."
            >
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="No due date"
                aria-label="Due date"
              />
            </Field>
            <Field label="Notes" help="Internal memo — never shown to the customer.">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="PO #4821, billed quarterly"
                rows={3}
                maxLength={500}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {formError ? (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: 'var(--st-danger, #dc2626)' }}>
          {formError}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Button asChild variant="ghost">
          <Link href="/sabpay/invoices">Cancel</Link>
        </Button>
        <Button
          variant="secondary"
          onClick={() => save(false)}
          loading={saving === 'draft'}
          disabled={saving !== null}
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          onClick={() => save(true)}
          loading={saving === 'issue'}
          disabled={saving !== null}
        >
          Save &amp; issue
        </Button>
      </div>
    </div>
  );
}
