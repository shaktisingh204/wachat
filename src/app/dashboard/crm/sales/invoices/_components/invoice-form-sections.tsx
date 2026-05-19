'use client';

import { ZoruCard, ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { Image as ImageIcon, X } from 'lucide-react';
/**
 * Section sub-cards for `<InvoiceForm>`. Hoisted out so the form file
 * stays under the 600-line cap. Each section is presentational —
 * controlled state lives in the parent.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import type {
  CrmInvoiceGstTreatment,
  CrmInvoiceRecurringFrequency,
} from '@/lib/rust-client/crm-invoices';

export interface HeaderSectionProps {
  defaultInvoiceNo: string;
  defaultDate: string;
  defaultDueDate: string;
  defaultPlaceOfSupply?: string;
  gstTreatment: CrmInvoiceGstTreatment | '';
  onGstTreatment: (next: CrmInvoiceGstTreatment | '') => void;
  reverseCharge: boolean;
  onReverseCharge: (next: boolean) => void;
}

export function HeaderSection({
  defaultInvoiceNo,
  defaultDate,
  defaultDueDate,
  defaultPlaceOfSupply,
  gstTreatment,
  onGstTreatment,
  reverseCharge,
  onReverseCharge,
}: HeaderSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Header
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="invoiceNo">
            Invoice number <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="invoiceNo"
            name="invoiceNo"
            required
            defaultValue={defaultInvoiceNo}
            className="mt-1.5"
            placeholder="INV-2026-0001"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="date">
            Invoice date <span className="text-zoru-danger-ink">*</span>
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
          <ZoruLabel htmlFor="dueDate">
            Due date <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={defaultDueDate}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="placeOfSupply">Place of supply</ZoruLabel>
          <ZoruInput
            id="placeOfSupply"
            name="placeOfSupply"
            defaultValue={defaultPlaceOfSupply ?? ''}
            className="mt-1.5"
            placeholder="29-Karnataka"
          />
        </div>
        <div>
          <ZoruLabel>GST treatment</ZoruLabel>
          <div className="mt-1.5">
            <EnumFormField
              enumName="gstTreatment"
              name="__gstTreatment_picker"
              initialId={gstTreatment || null}
              placeholder="Select treatment"
              onChange={(id) => onGstTreatment((id ?? '') as CrmInvoiceGstTreatment | '')}
            />
          </div>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={reverseCharge}
            onChange={(e) => onReverseCharge(e.target.checked)}
          />
          Reverse charge
        </label>
      </div>
    </ZoruCard>
  );
}

export interface CustomerSectionProps {
  initialClientId: string | null;
  currency: string;
  onCurrencyChange: (next: string) => void;
  billingAddress: string;
  onBillingAddress: (next: string) => void;
  shippingAddress: string;
  onShippingAddress: (next: string) => void;
}

export function CustomerSection({
  initialClientId,
  currency,
  onCurrencyChange,
  billingAddress,
  onBillingAddress,
  shippingAddress,
  onShippingAddress,
}: CustomerSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Customer
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel>
            Customer <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="client"
              name="clientId"
              initialId={initialClientId}
              required
            />
          </div>
        </div>
        <div>
          <ZoruLabel>Currency</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="currency"
              name="__currency_picker"
              initialId={currency}
              onChange={(id) => onCurrencyChange(id || 'INR')}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="billingAddress">Billing address</ZoruLabel>
          <ZoruTextarea
            id="billingAddress"
            rows={2}
            value={billingAddress}
            onChange={(e) => onBillingAddress(e.target.value)}
            className="mt-1.5"
            placeholder="Street, City, State, PIN"
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="shippingAddress">Shipping address</ZoruLabel>
          <ZoruTextarea
            id="shippingAddress"
            rows={2}
            value={shippingAddress}
            onChange={(e) => onShippingAddress(e.target.value)}
            className="mt-1.5"
            placeholder="Same as billing if blank"
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface NotesSectionProps {
  defaultPaymentTerms?: string;
  statusValue: string;
  onStatusChange: (next: string) => void;
  statusOptions: { value: string; label: string }[];
  defaultCustomerNotes?: string;
  defaultTermsAndConditions?: string;
}

export function NotesSection({
  defaultPaymentTerms,
  statusValue,
  onStatusChange,
  statusOptions: _statusOptions, // EnumFormField now drives values from CRM_ENUMS.invoiceStatus
  defaultCustomerNotes,
  defaultTermsAndConditions,
}: NotesSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Notes &amp; Terms
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="paymentTerms">Payment terms</ZoruLabel>
          <ZoruInput
            id="paymentTerms"
            name="paymentTerms"
            defaultValue={defaultPaymentTerms ?? ''}
            className="mt-1.5"
            placeholder="Net 30"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="status">Status</ZoruLabel>
          <div className="mt-1.5">
            <EnumFormField
              enumName="invoiceStatus"
              name="__status_picker"
              initialId={statusValue || null}
              onChange={(id) => onStatusChange(id ?? '')}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="customerNotes">Customer notes</ZoruLabel>
          <ZoruTextarea
            id="customerNotes"
            name="customerNotes"
            rows={3}
            defaultValue={defaultCustomerNotes ?? ''}
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="termsAndConditions">Terms &amp; conditions</ZoruLabel>
          <ZoruTextarea
            id="termsAndConditions"
            name="termsAndConditions"
            rows={3}
            defaultValue={defaultTermsAndConditions ?? ''}
            className="mt-1.5"
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface BankSectionProps {
  bankAccountId: string | null;
  onBankAccountId: (next: string | null) => void;
  upiId: string;
  onUpiId: (next: string) => void;
  qrImageFileId: string;
  onQrImageFileId: (next: string) => void;
}

export function BankSection({
  bankAccountId,
  onBankAccountId,
  upiId,
  onUpiId,
  qrImageFileId,
  onQrImageFileId,
}: BankSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Bank &amp; UPI
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel>Bank account</ZoruLabel>
          <div className="mt-1.5">
            <EntityFormField
              entity="bankAccount"
              name="__bank_picker"
              initialId={bankAccountId}
              onChange={(id) => onBankAccountId(id)}
            />
          </div>
        </div>
        <div>
          <ZoruLabel htmlFor="upiId">UPI id</ZoruLabel>
          <ZoruInput
            id="upiId"
            value={upiId}
            onChange={(e) => onUpiId(e.target.value)}
            className="mt-1.5"
            placeholder="name@bank"
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel>QR image</ZoruLabel>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <SabFilePickerButton
              accept="image"
              onPick={(p: SabFilePick) => onQrImageFileId(p.id)}
              variant="outline"
              className="h-9 gap-1.5 text-xs"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {qrImageFileId ? 'Replace image' : 'Pick QR image'}
            </SabFilePickerButton>
            {qrImageFileId ? (
              <div className="flex items-center gap-1 rounded-[var(--zoru-radius)] bg-zoru-surface px-2 py-1 text-xs text-zoru-ink">
                <span className="max-w-[200px] truncate font-mono">{qrImageFileId}</span>
                <button
                  type="button"
                  onClick={() => onQrImageFileId('')}
                  className="text-zoru-ink-muted hover:text-zoru-ink"
                  aria-label="Clear QR image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-zoru-ink-muted">
            Pick from your SabFiles library or upload a new image.
          </p>
        </div>
      </div>
    </ZoruCard>
  );
}

export interface EInvoiceSectionProps {
  irn: string;
  onIrn: (next: string) => void;
  qrString: string;
  onQrString: (next: string) => void;
  ackNo: string;
  onAckNo: (next: string) => void;
  ackDate: string;
  onAckDate: (next: string) => void;
}

export function EInvoiceSection({
  irn,
  onIrn,
  qrString,
  onQrString,
  ackNo,
  onAckNo,
  ackDate,
  onAckDate,
}: EInvoiceSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        E-invoice
      </h3>
      <p className="mb-3 text-[11px] text-zoru-ink-muted">
        {/* TODO 1D.3: e-invoice auto-fetch (IRP). Manual entry only. */}
        IRP auto-fetch deferred; enter manually if you have the IRN.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="eInvoiceIrn">IRN</ZoruLabel>
          <ZoruInput
            id="eInvoiceIrn"
            value={irn}
            onChange={(e) => onIrn(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="eInvoiceAckNo">Acknowledgement number</ZoruLabel>
          <ZoruInput
            id="eInvoiceAckNo"
            value={ackNo}
            onChange={(e) => onAckNo(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="eInvoiceAckDate">Acknowledgement date</ZoruLabel>
          <ZoruInput
            id="eInvoiceAckDate"
            type="date"
            value={ackDate}
            onChange={(e) => onAckDate(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="eInvoiceQr">QR string</ZoruLabel>
          <ZoruTextarea
            id="eInvoiceQr"
            rows={2}
            value={qrString}
            onChange={(e) => onQrString(e.target.value)}
            className="mt-1.5"
            placeholder="JSON payload encoded in the IRP QR"
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface RecurringSectionProps {
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  frequency: CrmInvoiceRecurringFrequency | '';
  onFrequency: (next: CrmInvoiceRecurringFrequency | '') => void;
  endDate: string;
  onEndDate: (next: string) => void;
  nextRun: string;
  onNextRun: (next: string) => void;
}

export function RecurringSection({
  enabled,
  onEnabled,
  frequency,
  onFrequency,
  endDate,
  onEndDate,
  nextRun,
  onNextRun,
}: RecurringSectionProps) {
  return (
    <ZoruCard className="p-6">
      <details open={enabled}>
        <summary className="cursor-pointer list-none">
          <h3 className="inline text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Recurring
          </h3>
          <label className="ml-3 inline-flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabled(e.target.checked)}
            />
            Enable
          </label>
        </summary>
        {enabled ? (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div>
              <ZoruLabel>Frequency</ZoruLabel>
              <div className="mt-1.5">
                <EnumFormField
                  enumName="recurringFrequency"
                  name="__recurringFrequency_picker"
                  initialId={frequency || null}
                  placeholder="Select"
                  onChange={(id) =>
                    onFrequency((id ?? '') as CrmInvoiceRecurringFrequency | '')
                  }
                />
              </div>
            </div>
            <div>
              <ZoruLabel htmlFor="recurringEnd">End date</ZoruLabel>
              <ZoruInput
                id="recurringEnd"
                type="date"
                value={endDate}
                onChange={(e) => onEndDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <ZoruLabel htmlFor="recurringNextRun">Next run</ZoruLabel>
              <ZoruInput
                id="recurringNextRun"
                type="date"
                value={nextRun}
                onChange={(e) => onNextRun(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        ) : null}
      </details>
    </ZoruCard>
  );
}

export interface EwayBillSectionProps {
  value: string;
  onChange: (next: string) => void;
}

export function EwayBillSection({ value, onChange }: EwayBillSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        E-way bill
      </h3>
      <div>
        <ZoruLabel htmlFor="ewayBillNo">E-way bill number</ZoruLabel>
        <ZoruInput
          id="ewayBillNo"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5"
        />
      </div>
    </ZoruCard>
  );
}
