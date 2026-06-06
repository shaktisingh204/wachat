'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import {
  useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

/**
 * <PurchaseOrderForm> — canonical create + edit form per
 * CRM_REBUILD_PLAN §1D.3.
 *
 * Sections (collapsible cards):
 *   1. Header — PO number, date, expected delivery, currency, payment
 *      terms.
 *   2. Vendor — vendor picker (prefill address/currency on select),
 *      reference no, buyer/owner, branch.
 *   3. Approval workflow — requested by (current user, read-only),
 *      approver, notes.
 *   4. Line items — item picker per row + HSN + qty + rate + discount
 *      + tax rate + amount; warehouse-per-line picker.
 *   5. Summary — subtotal, total tax, shipping, adjustment, round-off,
 *      total.
 *   6. Terms & conditions, internal notes, attachments.
 *
 * Server action: `savePurchaseOrderAction`. The FormData field names
 * match exactly what the action reads today — preserved per the rebuild
 * brief.
 *
 * Smart defaults:
 *   - `?fromKind=vendorBid&fromId=` pre-fills vendor + line items.
 *   - `?fromKind=rfq&fromId=` pre-fills vendor.
 *
 * Actions: Cancel · Save (draft) · Save & Submit for approval · Save &
 * New. DirtyFormPrompt + auto-save-draft localStorage.
 */

import Link from 'next/link';

import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import type {
  CrmPurchaseOrderDoc,
  CrmPurchaseOrderStatus,
} from '@/lib/rust-client/crm-purchase-orders';

import {
  ApprovalSection,
  HeaderSection,
  NotesSection,
  VendorSection,
} from './purchase-order-form-sections';
import { PurchaseOrderLineItems } from './purchase-order-line-items';
import { PurchaseOrderSummarySection } from './purchase-order-summary-section';
import {
  toDateInput,
  usePurchaseOrderForm,
  type SubmitIntent,
} from './use-purchase-order-form';

interface PurchaseOrderFormProps {
  /** Existing PO — present in Edit mode, omit for Create. */
  initial?: CrmPurchaseOrderDoc | null;
  /** Current session user id (defaults the "requested by" picker). */
  currentUserId?: string | null;
  /** Redirect after save; defaults to detail page or list. */
  redirectTo?: string;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: CrmPurchaseOrderStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
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
      {intent === 'save-approval'
        ? 'Save & submit for approval'
        : intent === 'save-new'
          ? 'Save & new'
          : editing
            ? 'Save changes'
            : 'Create purchase order'}
    </Button>
  );
}

export function PurchaseOrderForm({
  initial,
  currentUserId,
  redirectTo,
}: PurchaseOrderFormProps) {
  const sp = useSearchParams();
  const f = usePurchaseOrderForm({ initial, redirectTo });

  const fromKind = !f.editing ? (sp?.get('fromKind') ?? undefined) : undefined;
  const fromId = !f.editing ? (sp?.get('fromId') ?? undefined) : undefined;

  const defaultPoNo =
    initial?.poNo ?? `PO-${Date.now().toString().slice(-6)}`;
  const defaultDate =
    toDateInput(initial?.date) || new Date().toISOString().slice(0, 10);
  const defaultExpected = toDateInput(initial?.expectedDelivery);

  // The requested-by chip is read-only and defaults to the current
  // session user; the action layer doesn't accept the approval block
  // yet so this is informational.
  const requestedById =
    initial?.approval?.requestedBy
      ? String(initial.approval.requestedBy)
      : (currentUserId ?? null);

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
        name="items"
        value={JSON.stringify(f.lineItemsForSubmit)}
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

      {/* Section 1: Header */}
      <HeaderSection
        defaultPoNo={defaultPoNo}
        editing={f.editing}
        defaultDate={defaultDate}
        defaultExpectedDelivery={defaultExpected}
        defaultPaymentTerms={initial?.paymentTerms}
        currency={f.currency}
        onCurrencyChange={f.setCurrency}
      />

      {/* Section 2: Vendor */}
      <VendorSection
        initialVendorId={initial?.vendorId ?? null}
        referenceNo={f.referenceNo}
        onReferenceNo={f.setReferenceNo}
        initialBuyerId={f.buyerId}
        onBuyerChange={f.setBuyerId}
        initialBranchId={initial?.billingBranchId ?? null}
        initialWarehouseId={initial?.shipToWarehouseId ?? null}
      />

      {/* Section 3: Approval workflow */}
      <ApprovalSection
        requestedById={requestedById}
        approverId={f.approverId}
        onApproverChange={f.setApproverId}
        approvalNote={f.approvalNote}
        onApprovalNote={f.setApprovalNote}
      />

      {/* Section 4: Line items */}
      <PurchaseOrderLineItems
        rows={f.rows}
        currency={f.currency}
        onAddRow={f.addRow}
        onRemoveRow={f.removeRow}
        onPatchRow={f.patchRow}
      />

      {/* Section 5: Summary */}
      <PurchaseOrderSummarySection
        currency={f.currency}
        subTotal={f.subTotal}
        total={f.total}
        discountOverall={f.discountOverall}
        shippingCharge={f.shippingCharge}
        adjustment={f.adjustment}
        roundOff={f.roundOff}
        onDiscountOverall={f.setDiscountOverall}
        onShippingCharge={f.setShippingCharge}
        onAdjustment={f.setAdjustment}
        onRoundOff={f.setRoundOff}
      />

      {/* Section 6: Terms / notes / attachments */}
      <NotesSection
        defaultTermsAndConditions={initial?.termsAndConditions}
        defaultNotes={initial?.notes}
        statusValue={f.statusValue}
        onStatusChange={f.setStatusValue}
        statusOptions={STATUS_OPTIONS.map((s) => ({
          value: s.value,
          label: s.label,
        }))}
      />

      {/* TODO 1D.3: live preview pane deferred — would render a stylised
          PO print preview alongside the form. */}

      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-3">
        <Button variant="outline" asChild>
          <Link
            href={
              f.editing
                ? `/dashboard/crm/purchases/orders/${String(initial!._id)}`
                : '/dashboard/crm/purchases/orders'
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
              intent="save-approval"
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
