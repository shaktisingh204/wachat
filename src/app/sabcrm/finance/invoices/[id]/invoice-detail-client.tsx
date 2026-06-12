'use client';

/**
 * SabCRM Finance — Invoice detail client.
 *
 * Composes the doc-surface DocDetailPage with the invoice's workflow:
 *
 *   - status transitions per the crate vocabulary (issue, cancel,
 *     reopen) — validated again server-side;
 *   - Record payment → creates a real `crm-payment-receipts` document
 *     (applyTo + lineage) against a REAL picked payment account, then
 *     folds amountPaid/status onto the invoice;
 *   - Email invoice → gated sabcrm-email path; the recipient is the
 *     linked customer record's address, resolved server-side;
 *   - Print → `window.print()`; the kit's `@media print` rules keep
 *     only the paper region;
 *   - Edit → the same DocForm drawer the list uses, seeded from the
 *     document;
 *   - related-documents rail (lineage parents + receipt children) and
 *     an activity feed (created / emails / payments).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  FilePenLine,
  Mail,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import type {
  CrmInvoiceDoc,
  CrmInvoiceGstTreatment,
  CrmInvoiceStatus,
} from '@/lib/rust-client/crm-invoices';
import {
  emailSabcrmInvoice,
  recordSabcrmInvoicePayment,
  transitionSabcrmInvoiceStatus,
  updateSabcrmInvoiceFull,
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { deleteSabcrmInvoice } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPartyContact,
  SabcrmPaymentAccountOption,
  SabcrmPaymentMode,
  SabcrmRelatedDocRef,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine, safeNum } from '@/lib/sabcrm/finance-doc-math';

import {
  ConvertMenu,
  DocDetailPage,
  DocForm,
  blankDocLine,
  formatDocDate,
  formatDocMoney,
  type ConvertMenuItem,
  type DocActivityEntry,
  type DocDetailLine,
  type DocFormValues,
  type DocLineDraft,
} from '../../_components/doc-surface';
import {
  INVOICES_PATH,
  INVOICE_FLOW,
  INVOICE_GST_TREATMENTS,
  INVOICE_STATUSES,
  gstTreatmentLabel,
  partyRecordHref,
} from '../invoice-config';

/* ─── Helpers ─────────────────────────────────────────────────── */

const MODE_OPTIONS: SelectOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'wallet', label: 'Wallet' },
];

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Doc → DocForm seed (lines keep itemIds; labels fall back to text). */
function toFormValues(
  doc: CrmInvoiceDoc,
  contact: SabcrmPartyContact | null,
): DocFormValues {
  const lines: DocLineDraft[] = (doc.items ?? []).map((item, i) => ({
    rowId: `seed-${i}`,
    itemId: item.itemId,
    itemLabel: item.itemId ? (item.description ?? 'Catalog item') : null,
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
  }));
  return {
    number: doc.invoiceNo,
    partyId: doc.clientId || null,
    partyLabel: contact?.label ?? null,
    currency: doc.currency,
    date: (doc.date ?? '').slice(0, 10),
    dueDate: (doc.dueDate ?? '').slice(0, 10),
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: doc.paymentTerms ?? '',
    customerNotes: doc.customerNotes ?? '',
    termsAndConditions: doc.termsAndConditions ?? '',
    attachments: (doc.attachments ?? []).map((a) => ({
      fileId: a.fileId,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    placeOfSupply: doc.placeOfSupply ?? '',
    gstTreatment: doc.gstTreatment ?? null,
    tcsPct: doc.tcsPct,
    tdsPct: doc.tdsPct,
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
  };
}

/* ─── Record-payment dialog ───────────────────────────────────── */

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CrmInvoiceDoc;
  accounts: SabcrmPaymentAccountOption[];
  onDone: () => void;
}

function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  accounts,
  onDone,
}: PaymentDialogProps): React.JSX.Element {
  const total = invoice.totals?.total ?? 0;
  const balance = invoice.balance ?? total - (invoice.amountPaid ?? 0);
  const [amount, setAmount] = React.useState(String(Math.max(balance, 0) || ''));
  const [date, setDate] = React.useState(todayKey());
  const [mode, setMode] = React.useState<string | null>('upi');
  const [accountId, setAccountId] = React.useState<string | null>(
    accounts[0]?.id ?? null,
  );
  const [reference, setReference] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setAmount(String(Math.max(balance, 0) || ''));
    setDate(todayKey());
    setMode('upi');
    setAccountId(accounts[0]?.id ?? null);
    setReference('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const accountOptions: SelectOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.label,
  }));

  const submit = (): void => {
    const parsed = safeNum(amount);
    if (parsed <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!accountId) {
      setError('Pick the account that received this payment.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await recordSabcrmInvoicePayment(invoice._id, {
        amount: parsed,
        date,
        mode: (mode ?? 'cash') as SabcrmPaymentMode,
        bankAccountId: accountId,
        reference: reference || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        `Payment of ${formatDocMoney(parsed, invoice.currency)} recorded.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="pay-desc">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription id="pay-desc">
            {invoice.invoiceNo} — balance due{' '}
            {formatDocMoney(Math.max(balance, 0), invoice.currency)}. A payment
            receipt is created and linked to this invoice.
          </DialogDescription>
        </DialogHeader>

        {accounts.length === 0 ? (
          <Alert tone="warning" role="alert">
            No payment accounts yet — create one under{' '}
            <a href="/sabcrm/finance/payment-accounts">Finance → Payment accounts</a>{' '}
            first, so the receipt lands in a real account.
          </Alert>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-3 pb-2 pt-1">
              <Field label="Amount received" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <Field label="Payment date" required>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field label="Mode" required>
                <SelectField
                  value={mode}
                  onChange={setMode}
                  options={MODE_OPTIONS}
                  disabled={pending}
                />
              </Field>
              <Field label="Deposit to" required>
                <SelectField
                  value={accountId}
                  onChange={setAccountId}
                  options={accountOptions}
                  disabled={pending}
                />
              </Field>
              <Field label="Reference" help="UTR / transaction id (optional).">
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={pending}
                />
              </Field>
              {error ? (
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              ) : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant="primary" loading={pending}>
                Record payment
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Email dialog ────────────────────────────────────────────── */

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CrmInvoiceDoc;
  contact: SabcrmPartyContact | null;
  onDone: () => void;
}

function EmailDialog({
  open,
  onOpenChange,
  invoice,
  contact,
  onDone,
}: EmailDialogProps): React.JSX.Element {
  const defaultSubject = `Invoice ${invoice.invoiceNo}`;
  const defaultBody = [
    `Hi${contact ? ` ${contact.label}` : ''},`,
    '',
    `Please find invoice ${invoice.invoiceNo} for ${formatDocMoney(invoice.totals?.total ?? 0, invoice.currency)}, due ${formatDocDate(invoice.dueDate)}.`,
    '',
    'Thank you for your business.',
  ].join('\n');

  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState(defaultBody);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setBody(defaultBody);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (): void => {
    if (!subject.trim()) {
      setError('A subject is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await emailSabcrmInvoice(invoice._id, { subject, body });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Invoice emailed to ${res.data.to}.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="email-desc">
        <DialogHeader>
          <DialogTitle>Email invoice</DialogTitle>
          <DialogDescription id="email-desc">
            {contact?.email
              ? `Sends to ${contact.label} <${contact.email}> — the address on their CRM record.`
              : contact
                ? `${contact.label} has no email address on their record. Add one to their CRM record first.`
                : 'The linked customer record could not be found.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Subject" required>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending || !contact?.email}
                autoFocus
              />
            </Field>
            <Field label="Message" required>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                disabled={pending || !contact?.email}
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={!contact?.email}
            >
              Send email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface InvoiceDetailClientProps {
  invoice: CrmInvoiceDoc | null;
  contact: SabcrmPartyContact | null;
  related: SabcrmRelatedDocRef[];
  paymentAccounts: SabcrmPaymentAccountOption[];
  error: string | null;
}

export function InvoiceDetailClient({
  invoice,
  contact,
  related,
  paymentAccounts,
  error,
}: InvoiceDetailClientProps): React.JSX.Element {
  const router = useRouter();
  const [payOpen, setPayOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [transitioning, startTransition] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();

  const refresh = React.useCallback(() => router.refresh(), [router]);

  // Stable identity so DocForm's open-reset effect doesn't re-fire while
  // the user is typing.
  const editSeed = React.useMemo(
    () => (invoice ? toFormValues(invoice, contact) : undefined),
    [invoice, contact],
  );

  if (!invoice) {
    return (
      <DocDetailPage
        backHref={INVOICES_PATH}
        backLabel="Invoices"
        docNumber="Invoice"
        entitySingular="Invoice"
        statuses={INVOICE_STATUSES}
        flow={INVOICE_FLOW}
        status="draft"
        party={null}
        meta={[]}
        currency="INR"
        lines={[]}
        totals={{ subTotal: 0, total: 0 }}
        related={[]}
        error={error ?? 'Invoice not found.'}
      />
    );
  }

  const status = (invoice.status ?? 'draft') as CrmInvoiceStatus;
  const total = invoice.totals?.total ?? 0;
  const subTotal = invoice.totals?.subTotal ?? total;
  const amountPaid = invoice.amountPaid ?? 0;
  const balance = invoice.balance ?? total - amountPaid;
  // Σ line totals − subTotal = Σ per-line tax (each line.total is
  // taxable + tax while subTotal is Σ taxable) — exact regardless of
  // any header-level modifiers folded into totals.total.
  const lineTotalSum = (invoice.items ?? []).reduce(
    (s, item) => s + (item.total ?? 0),
    0,
  );
  const taxTotal = Math.max(0, lineTotalSum - subTotal);

  const transition = (next: CrmInvoiceStatus, success: string): void => {
    startTransition(async () => {
      const res = await transitionSabcrmInvoiceStatus(invoice._id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(success);
      refresh();
    });
  };

  const handleDelete = (): void => {
    startDelete(async () => {
      const res = await deleteSabcrmInvoice(invoice._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${invoice.invoiceNo} deleted.`);
      router.push(INVOICES_PATH);
      router.refresh();
    });
  };

  /* ---- actions bar ---- */
  const canPay =
    status === 'sent' || status === 'partially_paid' || status === 'overdue';
  const canEdit = status !== 'paid' && status !== 'cancelled';

  const menuItems: ConvertMenuItem[] = [];
  if (canPay) {
    menuItems.push({
      key: 'payment',
      label: 'Record payment',
      description: 'Creates a linked payment receipt',
      icon: Banknote,
      onSelect: () => setPayOpen(true),
    });
  }
  if (status === 'cancelled') {
    menuItems.push({
      key: 'reopen',
      label: 'Reopen as draft',
      icon: RotateCcw,
      onSelect: () => transition('draft', `${invoice.invoiceNo} reopened as draft.`),
    });
  }
  if (status !== 'cancelled' && status !== 'paid') {
    menuItems.push({
      key: 'cancel',
      label: 'Cancel invoice',
      icon: XCircle,
      danger: true,
      group: menuItems.length > 0,
      onSelect: () =>
        transition('cancelled', `${invoice.invoiceNo} cancelled.`),
    });
  }
  menuItems.push({
    key: 'delete',
    label: 'Delete invoice',
    icon: Trash2,
    danger: true,
    group: true,
    onSelect: () => setConfirmDelete(true),
  });

  const actions = (
    <>
      {status === 'draft' ? (
        <Button
          variant="primary"
          iconLeft={Send}
          loading={transitioning}
          onClick={() => transition('sent', `${invoice.invoiceNo} issued.`)}
        >
          Issue invoice
        </Button>
      ) : null}
      {canPay ? (
        <Button
          variant="primary"
          iconLeft={Banknote}
          onClick={() => setPayOpen(true)}
        >
          Record payment
        </Button>
      ) : null}
      <Button variant="secondary" iconLeft={Mail} onClick={() => setEmailOpen(true)}>
        Email
      </Button>
      <Button
        variant="secondary"
        iconLeft={Printer}
        onClick={() => window.print()}
      >
        Print
      </Button>
      {canEdit ? (
        <Button
          variant="secondary"
          iconLeft={FilePenLine}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
      ) : null}
      <ConvertMenu label="More" items={menuItems} disabled={transitioning} />
    </>
  );

  /* ---- paper data ---- */
  const lines: DocDetailLine[] = (invoice.items ?? []).map((item) => ({
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
    total: item.total,
  }));

  const treatmentLabel = gstTreatmentLabel(invoice.gstTreatment);
  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Invoice date', value: formatDocDate(invoice.date) },
    { label: 'Due date', value: formatDocDate(invoice.dueDate) },
    ...(invoice.paymentTerms
      ? [{ label: 'Payment terms', value: invoice.paymentTerms }]
      : []),
    { label: 'Currency', value: invoice.currency },
    ...(invoice.placeOfSupply
      ? [{ label: 'Place of supply', value: invoice.placeOfSupply }]
      : []),
    ...(treatmentLabel
      ? [{ label: 'GST treatment', value: treatmentLabel }]
      : []),
    ...(invoice.tcsPct
      ? [{ label: 'TCS', value: `${invoice.tcsPct}%` }]
      : []),
    ...(invoice.tdsPct
      ? [{ label: 'TDS', value: `${invoice.tdsPct}%` }]
      : []),
    // E-invoice envelope + e-way bill — read-only compliance refs,
    // rendered only once the IRP / transport workflows populate them.
    ...(invoice.eInvoice?.irn
      ? [{ label: 'IRN', value: invoice.eInvoice.irn }]
      : []),
    ...(invoice.eInvoice?.ackNo
      ? [
          {
            label: 'E-invoice ack',
            value: `${invoice.eInvoice.ackNo}${
              invoice.eInvoice.ackDate
                ? ` · ${formatDocDate(invoice.eInvoice.ackDate)}`
                : ''
            }`,
          },
        ]
      : []),
    ...(invoice.ewayBillNo
      ? [{ label: 'E-way bill', value: invoice.ewayBillNo }]
      : []),
  ];

  /* ---- activity ---- */
  const createdAt = invoice.audit?.createdAt ?? invoice.createdAt;
  const activity: DocActivityEntry[] = [];
  if (createdAt) {
    activity.push({
      id: 'created',
      icon: FilePenLine,
      title: 'Invoice created',
      at: createdAt,
    });
  }
  for (const [i, log] of (invoice.emailLog ?? []).entries()) {
    activity.push({
      id: `email-${i}`,
      icon: Mail,
      title: `Emailed to ${log.to}`,
      meta: log.status,
      at: log.sentAt,
    });
  }
  for (const ref of related.filter((r) => r.kind === 'paymentReceipt')) {
    activity.push({
      id: `receipt-${ref.id}`,
      icon: Banknote,
      title: `Payment ${ref.label}${
        ref.amount !== undefined
          ? ` — ${formatDocMoney(ref.amount, ref.currency ?? invoice.currency)}`
          : ''
      }`,
      at: ref.date,
    });
  }
  activity.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return (
    <>
      <DocDetailPage
        backHref={INVOICES_PATH}
        backLabel="Invoices"
        docNumber={invoice.invoiceNo}
        entitySingular="Invoice"
        statuses={INVOICE_STATUSES}
        flow={INVOICE_FLOW}
        status={status}
        actions={actions}
        party={
          contact
            ? {
                label: contact.label,
                href: partyRecordHref(contact.objectSlug, contact.id),
                meta: contact.email,
                addressLines: contact.addressLines,
              }
            : null
        }
        meta={meta}
        currency={invoice.currency}
        lines={lines}
        totals={{
          subTotal,
          taxTotal,
          discountOverall: invoice.totals?.discountOverall,
          shippingCharge: invoice.totals?.shippingCharge,
          adjustment: invoice.totals?.adjustment,
          roundOff: invoice.totals?.roundOff,
          total,
          amountPaid,
          balance,
        }}
        notes={invoice.customerNotes}
        terms={invoice.termsAndConditions}
        related={related}
        attachments={invoice.attachments}
        activity={activity}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={invoice}
        accounts={paymentAccounts}
        onDone={refresh}
      />

      <EmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoice={invoice}
        contact={contact}
        onDone={refresh}
      />

      <DocForm
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialValues={editSeed}
        config={{
          entitySingular: 'Invoice',
          numberLabel: 'Invoice number',
          partyLabel: 'Customer',
          partyPlaceholder: 'Search companies & people…',
          dateLabel: 'Invoice date',
          dueDateLabel: 'Due date',
          searchParties: async (q) => {
            const res = await searchSabcrmFinanceParties(q);
            return res.ok ? res.data : [];
          },
          searchItems: async (q) => {
            const res = await searchSabcrmFinanceItems(q);
            if (!res.ok) return [];
            return res.data.map((item) => ({
              id: item.id,
              label: item.name,
              meta: item.sku,
              rate: item.sellingPrice,
              taxRatePct: item.taxRate,
              hsnSac: item.hsnSac,
              description: item.description ?? item.name,
            }));
          },
          taxFields: {
            placeOfSupply: true,
            gstTreatments: INVOICE_GST_TREATMENTS,
            withholding: true,
          },
          totalsModifiers: true,
          lineExtras: true,
        }}
        onSubmit={async (values) => {
          const res = await updateSabcrmInvoiceFull(invoice._id, {
            invoiceNo: values.number,
            clientId: values.partyId ?? undefined,
            currency: values.currency,
            date: values.date,
            dueDate: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers ?? {},
            placeOfSupply: values.placeOfSupply ?? '',
            gstTreatment:
              (values.gstTreatment as CrmInvoiceGstTreatment | null) ??
              undefined,
            tcsPct: values.tcsPct,
            tdsPct: values.tdsPct,
            paymentTerms: values.paymentTerms,
            customerNotes: values.customerNotes,
            termsAndConditions: values.termsAndConditions,
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.invoiceNo} updated.`);
          refresh();
          return { ok: true };
        }}
      />

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!next && !deleting) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {invoice.invoiceNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice from this workspace. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
