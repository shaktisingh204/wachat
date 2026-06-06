'use client';

import { Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

/**
 * <InvoiceForm> — canonical create + edit form per CRM_REBUILD_PLAN §1D.3.
 *
 * Sections (collapsible cards):
 *   1. Header — invoice number, dates, place of supply, reverse charge,
 *      GST treatment.
 *   2. Customer — client picker, billing + shipping addresses.
 *   3. Line items — qty, rate, discount, tax, totals (auto-computed).
 *   4. Summary — subtotal, discount, shipping, adjustment, round-off,
 *      TCS / TDS, total, balance.
 *   5. Bank / UPI — bank picker, UPI id, QR image (SabFile).
 *   6. E-invoice — IRN, QR string, ack number/date.
 *   7. E-way bill — number.
 *   8. Recurring — frequency, end date, next run.
 *   9. Notes / T&C — customer notes, terms, attachments.
 *
 * Server action: `saveInvoiceAction`. The FormData field names match
 * exactly what the action reads today; new sections (bank, e-invoice,
 * etc.) are surfaced through the UI and shipped via `customFields` JSON
 * so the action signature stays stable.
 *
 * Behaviour:
 *   - `?fromKind=quote|so|deal&fromId=` pre-fills via the source doc.
 *   - DirtyFormPrompt blocks tab close + reload while edits are unsaved.
 *   - Auto-save draft to localStorage every 30s (Create mode only).
 *   - Cancel, Save, Save & Send, Save & New action buttons.
 */

import Link from 'next/link';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { CustomFieldInput } from '@/components/crm/custom-field-input';
import type {
  CrmInvoiceDoc,
  CrmInvoiceStatus,
} from '@/lib/rust-client/crm-invoices';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import {
  BankSection,
  CustomerSection,
  EInvoiceSection,
  EwayBillSection,
  HeaderSection,
  NotesSection,
  RecurringSection,
} from './invoice-form-sections';
import { CrmStatutoryCalculator, type CalculatorItem, type CalculationTotals } from '@/components/crm/crm-statutory-calculator';
import { toDateInput, useInvoiceForm, type SubmitIntent } from './use-invoice-form';

interface InvoiceFormProps {
  /** Existing invoice — present in Edit mode, omit for Create. */
  initial?: CrmInvoiceDoc | null;
  /** Custom field definitions for `belongs_to = 'invoice'`. */
  customFields: WsCustomField[];
  /** Redirect after save; defaults to detail page or list. */
  redirectTo?: string;
}

const STATUS_OPTIONS: { value: CrmInvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

function SubmitButton({
  editing,
  intent,
  pendingIntent,
  setIntent,
}: {
  editing: boolean;
  intent: SubmitIntent;
  pendingIntent: string | null;
  setIntent: (i: SubmitIntent) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={() => setIntent(intent)}
      aria-busy={pending && pendingIntent === intent ? true : undefined}
    >
      {pending && pendingIntent === intent ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : null}
      {intent === 'save-send'
        ? 'Save & send'
        : intent === 'save-new'
          ? 'Save & new'
          : editing
            ? 'Save changes'
            : 'Create invoice'}
    </Button>
  );
}

export function InvoiceForm({
  initial,
  customFields,
  redirectTo,
}: InvoiceFormProps) {
  const sp = useSearchParams();
  const f = useInvoiceForm({ initial, customFields, redirectTo });

  const [placeOfSupply, setPlaceOfSupply] = React.useState<string>(initial?.placeOfSupply || 'Maharashtra');
  const [companyBaseState] = React.useState<string>('Maharashtra');
  const [tdsPercent, setTdsPercent] = React.useState<number>(initial?.tdsPct ?? 0);
  const [tcsPercent, setTcsPercent] = React.useState<number>(initial?.tcsPct ?? 0);

  const fromKind = !f.editing ? sp?.get('fromKind') ?? undefined : undefined;
  const fromId = !f.editing ? sp?.get('fromId') ?? undefined : undefined;

  const calculatorItems: CalculatorItem[] = React.useMemo(() => {
    return f.rows.map((row) => ({
      itemId: row._key,
      name: row.description || '',
      qty: row.qty,
      rate: row.rate,
      discountPercent: row.discountPct ?? 0,
      taxRatePercent: row.taxRatePct ?? 18,
    }));
  }, [f.rows]);

  const handleCalculatorItemsChange = (newItems: CalculatorItem[]) => {
    const isIntra = placeOfSupply.toLowerCase().trim() === companyBaseState.toLowerCase().trim();
    const nextRows = newItems.map((item) => {
      const existing = f.rows.find((r) => r._key === item.itemId);
      const qty = item.qty;
      const rate = item.rate;
      const discountPct = item.discountPercent;
      const taxRatePct = item.taxRatePercent;
      const baseLine = qty * rate;
      const rowTaxable = Math.max(0, baseLine * (1 - discountPct / 100));
      const taxAmount = rowTaxable * (taxRatePct / 100);
      const cgstAmount = isIntra ? taxAmount / 2 : 0;
      const sgstAmount = isIntra ? taxAmount / 2 : 0;
      const igstAmount = isIntra ? 0 : taxAmount;
      const total = rowTaxable + taxAmount;
      
      return {
        _key: item.itemId,
        itemId: existing?.itemId,
        description: item.name,
        qty,
        rate,
        discountPct,
        taxRatePct,
        cgstAmount,
        sgstAmount,
        igstAmount,
        total: Number.isFinite(total) ? total : 0,
      };
    });
    f.setRows(nextRows);
  };

  const handleTotalsChange = (totals: CalculationTotals) => {
    f.setRoundOff(String(totals.roundOff));
  };

  return (
    <form
      ref={f.formRef}
      action={f.formAction}
      onSubmit={f.handleFormSubmit}
      className="space-y-6"
    >
      <DirtyFormPrompt dirty={f.dirty} />

      {f.editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      {fromKind && fromId ? (
        <>
          <input type="hidden" name="fromKind" value={fromKind} />
          <input type="hidden" name="fromId" value={fromId} />
        </>
      ) : null}
      <input type="hidden" name="currency" value={f.currency} />
      <input
        type="hidden"
        name="lineItems"
        value={JSON.stringify(f.lineItemsForSubmit)}
      />
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(f.customFieldsForSubmit)}
      />
      <input
        type="hidden"
        name="discountOverall"
        value={f.discountOverall || ''}
      />
      <input
        type="hidden"
        name="shippingCharge"
        value={f.shippingCharge || ''}
      />
      <input type="hidden" name="adjustment" value={f.adjustment || ''} />
      <input type="hidden" name="roundOff" value={f.roundOff || ''} />
      <input type="hidden" name="status" value={f.statusValue} />
      <input type="hidden" name="tdsPct" value={tdsPercent} />
      <input type="hidden" name="tcsPct" value={tcsPercent} />

      {/* Section 1: Header */}
      <HeaderSection
        defaultInvoiceNo={
          initial?.invoiceNo ?? `INV-${Date.now().toString().slice(-6)}`
        }
        defaultDate={
          toDateInput(initial?.date) || new Date().toISOString().slice(0, 10)
        }
        defaultDueDate={toDateInput(initial?.dueDate)}
        placeOfSupply={placeOfSupply}
        onPlaceOfSupplyChange={setPlaceOfSupply}
        gstTreatment={f.gstTreatment}
        onGstTreatment={f.setGstTreatment}
        reverseCharge={f.reverseCharge}
        onReverseCharge={f.setReverseCharge}
      />

      {/* Section 2: Customer */}
      <CustomerSection
        initialClientId={initial?.clientId ?? null}
        currency={f.currency}
        onCurrencyChange={f.setCurrency}
        billingAddress={f.billingAddress}
        onBillingAddress={f.setBillingAddress}
        shippingAddress={f.shippingAddress}
        onShippingAddress={f.setShippingAddress}
      />

      {/* Section 3 & 4: Bulky Statutory Calculator */}
      <CrmStatutoryCalculator
        items={calculatorItems}
        onChangeItems={handleCalculatorItemsChange}
        placeOfSupplyState={placeOfSupply}
        companyBaseState={companyBaseState}
        tdsPercent={tdsPercent}
        onChangeTdsPercent={setTdsPercent}
        tcsPercent={tcsPercent}
        onChangeTcsPercent={setTcsPercent}
        discountOverallVal={Number(f.discountOverall) || 0}
        onChangeDiscountOverallVal={(v) => f.setDiscountOverall(String(v))}
        shippingCharge={Number(f.shippingCharge) || 0}
        onChangeShippingCharge={(v) => f.setShippingCharge(String(v))}
        adjustment={Number(f.adjustment) || 0}
        onChangeAdjustment={(v) => f.setAdjustment(String(v))}
        onTotalsChange={handleTotalsChange}
      />

      {/* Section 5: Bank / UPI */}
      <BankSection
        bankAccountId={f.bankAccountId}
        onBankAccountId={f.setBankAccountId}
        upiId={f.upiId}
        onUpiId={f.setUpiId}
        qrImageFileId={f.qrImageFileId}
        onQrImageFileId={f.setQrImageFileId}
      />

      {/* Section 6: E-invoice */}
      <EInvoiceSection
        irn={f.eInvoiceIrn}
        onIrn={f.setEInvoiceIrn}
        qrString={f.eInvoiceQr}
        onQrString={f.setEInvoiceQr}
        ackNo={f.eInvoiceAckNo}
        onAckNo={f.setEInvoiceAckNo}
        ackDate={f.eInvoiceAckDate}
        onAckDate={f.setEInvoiceAckDate}
      />

      {/* Section 7: E-way bill */}
      <EwayBillSection value={f.ewayBillNo} onChange={f.setEwayBillNo} />

      {/* Section 8: Recurring */}
      <RecurringSection
        enabled={f.recurringEnabled}
        onEnabled={f.setRecurringEnabled}
        frequency={f.recurringFrequency}
        onFrequency={f.setRecurringFrequency}
        endDate={f.recurringEnd}
        onEndDate={f.setRecurringEnd}
        nextRun={f.recurringNextRun}
        onNextRun={f.setRecurringNextRun}
      />

      {/* Section 9: Notes / T&C */}
      <NotesSection
        defaultPaymentTerms={initial?.paymentTerms}
        statusValue={f.statusValue}
        onStatusChange={f.setStatusValue}
        statusOptions={STATUS_OPTIONS}
        defaultCustomerNotes={initial?.customerNotes}
        defaultTermsAndConditions={initial?.termsAndConditions}
      />

      {customFields.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((field) => (
              <CustomFieldInput
                key={String(field._id ?? field.name)}
                field={field}
                value={f.customFieldValues[field.name]}
                onChange={(v) => f.handleCustomFieldChange(field.name, v)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {/* TODO 1D.3: live preview pane deferred — would render a stylised
          PDF-like preview alongside the form. */}

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-3">
        <Button variant="outline" asChild>
          <Link
            href={
              f.editing
                ? `/dashboard/crm/sales/invoices/${String(initial!._id)}`
                : '/dashboard/crm/sales/invoices'
            }
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton
          editing={f.editing}
          intent="save"
          pendingIntent={f.pendingIntent}
          setIntent={f.setSubmitIntent}
        />
        {!f.editing ? (
          <>
            <SubmitButton
              editing={f.editing}
              intent="save-send"
              pendingIntent={f.pendingIntent}
              setIntent={f.setSubmitIntent}
            />
            <SubmitButton
              editing={f.editing}
              intent="save-new"
              pendingIntent={f.pendingIntent}
              setIntent={f.setSubmitIntent}
            />
          </>
        ) : null}
      </div>
    </form>
  );
}
