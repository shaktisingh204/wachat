'use client';

import { Button, Card } from '@/components/sabcrm/20ui/compat';
import {
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

/**
 * <BillForm> — canonical create + edit form per CRM_REBUILD_PLAN §1D.
 *
 * Sections (cards):
 *   1. Header — bill number, vendor invoice no, dates, place of supply,
 *      reverse charge.
 *   2. Vendor — vendor picker + currency.
 *   3. Entry mode toggle — Inventory line items OR Expense lines.
 *   4. TDS — section + amount.
 *   5. Summary — subtotal, total, amount paid (RO), balance.
 *   6. Recurring (collapsible) — frequency, end date, next run.
 *   7. Linked PO / GRNs.
 *   8. Status + notes.
 *
 * Server action: `saveBillAction`. The FormData field names match
 * exactly what the action reads (`billNo`, `vendorInvoiceNo`, `vendorId`,
 * `billDate`, `dueDate`, `currency`, `lineItems`, `expenseLines`,
 * `tdsSection`, `tdsAmount`, `reverseCharge`, `placeOfSupply`, `notes`,
 * `status`, `customFields`, `fromKind`, `fromId`).
 *
 * Behaviour:
 *   - `?fromKind=purchaseOrder|grn&fromId=` pre-fills via the source doc.
 *   - DirtyFormPrompt blocks tab close + reload while edits are unsaved.
 *   - Auto-save draft to localStorage every 30s (Create mode only).
 *   - Cancel, Save, Save & Pay, Save & New buttons.
 */

import Link from 'next/link';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import { CustomFieldInput } from '@/components/crm/custom-field-input';
import type {
  CrmBillDoc,
  CrmBillStatus,
} from '@/lib/rust-client/crm-bills';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import {
  HeaderSection,
  LinkedSection,
  NotesSection,
  RecurringSection,
  TdsSection,
  VendorSection,
} from './bill-form-sections';
import { BillLineItems } from './bill-line-items';
import { BillExpenseLines } from './bill-expense-lines';
import { BillSummarySection } from './bill-summary-section';
import {
  toDateInput,
  useBillForm,
  type EntryMode,
  type SubmitIntent,
} from './use-bill-form';

interface BillFormProps {
  /** Existing bill — present in Edit mode, omit for Create. */
  initial?: CrmBillDoc | null;
  /** Custom field definitions for `belongs_to = 'expense'`. */
  customFields: WsCustomField[];
  /** Redirect after save; defaults to detail page or list. */
  redirectTo?: string;
}

const STATUS_OPTIONS: { value: CrmBillStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
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
      {intent === 'save-pay'
        ? 'Save & pay'
        : intent === 'save-new'
          ? 'Save & new'
          : editing
            ? 'Save changes'
            : 'Create bill'}
    </Button>
  );
}

function EntryModeToggle({
  value,
  onChange,
}: {
  value: EntryMode;
  onChange: (next: EntryMode) => void;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Entry mode
          </h3>
          <p className="text-[12px] text-zoru-ink-muted">
            Inventory items roll up to GST tax; expense lines map straight
            to ledger accounts.
          </p>
        </div>
        <div className="flex items-center rounded border border-zoru-line bg-zoru-surface p-0.5">
          <Button
            type="button"
            size="sm"
            variant={value === 'items' ? 'default' : 'ghost'}
            onClick={() => onChange('items')}
            aria-pressed={value === 'items'}
          >
            Line items
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === 'expenses' ? 'default' : 'ghost'}
            onClick={() => onChange('expenses')}
            aria-pressed={value === 'expenses'}
          >
            Expense lines
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function BillForm({ initial, customFields, redirectTo }: BillFormProps) {
  const sp = useSearchParams();
  const f = useBillForm({ initial, customFields, redirectTo });

  const fromKind = !f.editing ? sp?.get('fromKind') ?? undefined : undefined;
  const fromId = !f.editing ? sp?.get('fromId') ?? undefined : undefined;

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
        name="expenseLines"
        value={JSON.stringify(f.expenseLinesForSubmit)}
      />
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(f.customFieldsForSubmit)}
      />
      <input type="hidden" name="status" value={f.statusValue} />

      <HeaderSection
        defaultBillNo={initial?.billNo ?? `BILL-${Date.now().toString().slice(-6)}`}
        defaultVendorInvoiceNo={initial?.vendorInvoiceNo}
        defaultBillDate={
          toDateInput(initial?.billDate) || new Date().toISOString().slice(0, 10)
        }
        defaultDueDate={toDateInput(initial?.dueDate)}
        defaultPlaceOfSupply={initial?.placeOfSupply}
        reverseCharge={f.reverseCharge}
        onReverseCharge={f.setReverseCharge}
      />

      <VendorSection
        initialVendorId={initial?.vendorId ?? null}
        currency={f.currency}
        onCurrencyChange={f.setCurrency}
      />

      <EntryModeToggle value={f.entryMode} onChange={f.setEntryMode} />

      {f.entryMode === 'items' ? (
        <BillLineItems
          rows={f.itemRows}
          currency={f.currency}
          onAddRow={f.addItemRow}
          onRemoveRow={f.removeItemRow}
          onPatchRow={f.patchItemRow}
        />
      ) : (
        <BillExpenseLines
          rows={f.expenseRows}
          currency={f.currency}
          onAddRow={f.addExpenseRow}
          onRemoveRow={f.removeExpenseRow}
          onPatchRow={f.patchExpenseRow}
        />
      )}

      <TdsSection
        defaultTdsSection={initial?.tdsSection}
        defaultTdsAmount={initial?.tdsAmount ?? ''}
      />

      <BillSummarySection
        currency={f.currency}
        subTotal={f.subTotal}
        total={f.total}
        editing={f.editing}
        amountPaid={initial?.amountPaid}
        balance={initial?.balance}
      />

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

      <LinkedSection
        linkedPoId={f.linkedPoId}
        onLinkedPoId={f.setLinkedPoId}
        linkedGrnIds={f.linkedGrnIds}
        onLinkedGrnIds={f.setLinkedGrnIds}
      />

      <NotesSection
        defaultNotes={initial?.notes}
        statusValue={f.statusValue}
        onStatusChange={f.setStatusValue}
        statusOptions={STATUS_OPTIONS}
      />

      {customFields.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
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

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
        <Button variant="outline" asChild>
          <Link
            href={
              f.editing
                ? `/dashboard/crm/purchases/expenses/${String(initial!._id)}`
                : '/dashboard/crm/purchases/expenses'
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
              intent="save-pay"
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
