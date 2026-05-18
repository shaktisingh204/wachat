'use client';

import { ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
/**
 * Section sub-cards for `<PurchaseOrderForm>`. Hoisted out so the form
 * file stays under the 600-line cap. Each section is presentational —
 * controlled state lives in the parent.
 *
 * Mirrors the Invoices `_components/invoice-form-sections.tsx`
 * structure: each section is a focused, named card with its own
 * controlled prop surface.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

export interface HeaderSectionProps {
  defaultPoNo: string;
  editing: boolean;
  defaultDate: string;
  defaultExpectedDelivery: string;
  defaultPaymentTerms?: string;
  currency: string;
  onCurrencyChange: (next: string) => void;
}

export function HeaderSection({
  defaultPoNo,
  editing,
  defaultDate,
  defaultExpectedDelivery,
  defaultPaymentTerms,
  currency,
  onCurrencyChange,
}: HeaderSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Header
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="poNo">
            PO number <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="poNo"
            name="poNo"
            required={!editing}
            readOnly={editing}
            defaultValue={defaultPoNo}
            placeholder="PO-2026-0001"
            className="mt-1.5"
          />
          {editing ? (
            <p className="mt-1 text-[11px] text-zoru-ink-muted">
              PO numbers are immutable — rotate via cancel + new PO.
            </p>
          ) : null}
        </div>
        <div>
          <ZoruLabel htmlFor="date">
            PO date <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="date"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="expectedDelivery">Expected delivery</ZoruLabel>
          <ZoruInput
            id="expectedDelivery"
            name="expectedDelivery"
            type="date"
            defaultValue={defaultExpectedDelivery}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="paymentTerms">Payment terms</ZoruLabel>
          <ZoruInput
            id="paymentTerms"
            name="paymentTerms"
            defaultValue={defaultPaymentTerms ?? ''}
            placeholder="Net 30 / 50% advance / …"
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel>Currency</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="currency"
              name="_currencyChip"
              initialId={currency}
              onChange={(next) => onCurrencyChange(next || 'INR')}
            />
          </div>
        </div>
      </div>
    </ZoruCard>
  );
}

export interface VendorSectionProps {
  initialVendorId: string | null;
  referenceNo: string;
  onReferenceNo: (next: string) => void;
  initialBuyerId: string | null;
  onBuyerChange: (next: string | null) => void;
  initialBranchId: string | null;
  initialWarehouseId: string | null;
}

export function VendorSection({
  initialVendorId,
  referenceNo,
  onReferenceNo,
  initialBuyerId,
  onBuyerChange,
  initialBranchId,
  initialWarehouseId,
}: VendorSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Vendor
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel>
            Vendor <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="vendor"
              name="vendorId"
              initialId={initialVendorId}
              required
            />
          </div>
        </div>
        <div>
          <ZoruLabel htmlFor="referenceNo">Vendor reference no</ZoruLabel>
          <ZoruInput
            id="referenceNo"
            value={referenceNo}
            onChange={(e) => onReferenceNo(e.target.value)}
            className="mt-1.5"
            placeholder="Their quote # / RFQ #"
          />
        </div>
        <div>
          <ZoruLabel>Buyer / Owner</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="user"
              name="__buyerPicker"
              initialId={initialBuyerId}
              onChange={onBuyerChange}
            />
          </div>
        </div>
        <div>
          <ZoruLabel>Billing branch</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="branch"
              name="billingBranchId"
              initialId={initialBranchId}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <ZoruLabel>Ship-to warehouse</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="warehouse"
              name="shipToWarehouseId"
              initialId={initialWarehouseId}
            />
          </div>
        </div>
      </div>
    </ZoruCard>
  );
}

export interface ApprovalSectionProps {
  requestedById: string | null;
  approverId: string | null;
  onApproverChange: (next: string | null) => void;
  approvalNote: string;
  onApprovalNote: (next: string) => void;
}

export function ApprovalSection({
  requestedById,
  approverId,
  onApproverChange,
  approvalNote,
  onApprovalNote,
}: ApprovalSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Approval workflow
      </h3>
      <p className="mb-3 text-[11px] text-zoru-ink-muted">
        Approver fields are surfaced for context; the Rust handler does
        not yet accept the full approval block via PATCH. Use the detail
        page Approve button to advance the workflow.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel>Requested by</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="user"
              name="__requestedByPicker"
              initialId={requestedById}
              disabled
            />
          </div>
        </div>
        <div>
          <ZoruLabel>Approver</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="user"
              name="__approverPicker"
              initialId={approverId}
              onChange={onApproverChange}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="approvalNote">Approval notes</ZoruLabel>
          <ZoruTextarea
            id="approvalNote"
            rows={2}
            value={approvalNote}
            onChange={(e) => onApprovalNote(e.target.value)}
            className="mt-1.5"
            placeholder="Justification for the procurement, budget ref, etc."
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface NotesSectionProps {
  defaultTermsAndConditions?: string;
  defaultNotes?: string;
  statusValue: string;
  onStatusChange: (next: string) => void;
  statusOptions: { value: string; label: string }[];
}

export function NotesSection({
  defaultTermsAndConditions,
  defaultNotes,
  statusValue,
  onStatusChange,
  statusOptions,
}: NotesSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Notes &amp; Terms
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="termsAndConditions">
            Terms &amp; conditions
          </ZoruLabel>
          <ZoruTextarea
            id="termsAndConditions"
            name="termsAndConditions"
            defaultValue={defaultTermsAndConditions ?? ''}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="notes">Internal notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            defaultValue={defaultNotes ?? ''}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="status">Status</ZoruLabel>
          <div className="mt-1.5">
            <EnumFormField
              enumName="purchaseOrderStatusV2"
              name="__status_picker"
              initialId={statusValue || null}
              onChange={(id) => onStatusChange(id ?? '')}
            />
          </div>
        </div>
        <div>
          <ZoruLabel htmlFor="attachmentsFileId">Attachments</ZoruLabel>
          <ZoruInput
            id="attachmentsFileId"
            name="attachmentsFileId"
            placeholder="Paste a SabFile id"
            className="mt-1.5"
          />
          {/* TODO 1D.3: wire <SabFilePickerButton/> for PO attachments */}
          <p className="mt-1 text-[11px] text-zoru-ink-muted">
            Use a SabFile id. Picker integration is queued.
          </p>
        </div>
      </div>
    </ZoruCard>
  );
}
