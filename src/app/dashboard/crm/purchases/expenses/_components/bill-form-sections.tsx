'use client';

/**
 * Section sub-cards for `<BillForm>`. Hoisted out so the form file
 * stays under the 600-line cap. Each section is presentational —
 * controlled state lives in the parent.
 */

import * as React from 'react';

import {
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import type { CrmBillRecurringFrequency } from '@/lib/rust-client/crm-bills';

export interface HeaderSectionProps {
  defaultBillNo: string;
  defaultVendorInvoiceNo?: string;
  defaultBillDate: string;
  defaultDueDate: string;
  defaultPlaceOfSupply?: string;
  reverseCharge: boolean;
  onReverseCharge: (next: boolean) => void;
}

export function HeaderSection({
  defaultBillNo,
  defaultVendorInvoiceNo,
  defaultBillDate,
  defaultDueDate,
  defaultPlaceOfSupply,
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
          <ZoruLabel htmlFor="billNo">Bill number</ZoruLabel>
          <ZoruInput
            id="billNo"
            name="billNo"
            defaultValue={defaultBillNo}
            className="mt-1.5"
            placeholder="BILL-2026-0001"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="vendorInvoiceNo">Vendor invoice number</ZoruLabel>
          <ZoruInput
            id="vendorInvoiceNo"
            name="vendorInvoiceNo"
            defaultValue={defaultVendorInvoiceNo ?? ''}
            className="mt-1.5"
            placeholder="INV-9876"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="billDate">
            Bill date <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="billDate"
            name="billDate"
            type="date"
            required
            defaultValue={defaultBillDate}
            className="mt-1.5"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="dueDate">Due date</ZoruLabel>
          <ZoruInput
            id="dueDate"
            name="dueDate"
            type="date"
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
        <label className="mt-2 inline-flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="reverseCharge"
            value="true"
            checked={reverseCharge}
            onChange={(e) => onReverseCharge(e.target.checked)}
          />
          Reverse charge (GST)
        </label>
      </div>
    </ZoruCard>
  );
}

export interface VendorSectionProps {
  initialVendorId: string | null;
  currency: string;
  onCurrencyChange: (next: string) => void;
}

export function VendorSection({
  initialVendorId,
  currency,
  onCurrencyChange,
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
      </div>
    </ZoruCard>
  );
}

export interface TdsSectionProps {
  defaultTdsSection?: string;
  defaultTdsAmount?: number | string;
}

export function TdsSection({
  defaultTdsSection,
  defaultTdsAmount,
}: TdsSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        TDS
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="tdsSection">TDS section</ZoruLabel>
          <ZoruInput
            id="tdsSection"
            name="tdsSection"
            defaultValue={defaultTdsSection ?? ''}
            className="mt-1.5"
            placeholder="194C"
          />
        </div>
        <div>
          <ZoruLabel htmlFor="tdsAmount">TDS amount</ZoruLabel>
          <ZoruInput
            id="tdsAmount"
            name="tdsAmount"
            type="number"
            step="0.01"
            min={0}
            defaultValue={defaultTdsAmount ?? ''}
            className="mt-1.5"
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface NotesSectionProps {
  defaultNotes?: string;
  statusValue: string;
  onStatusChange: (next: string) => void;
  statusOptions: { value: string; label: string }[];
}

export function NotesSection({
  defaultNotes,
  statusValue,
  onStatusChange,
  statusOptions: _statusOptions, // EnumFormField now drives values from CRM_ENUMS.billStatusV2
}: NotesSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Status &amp; Notes
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="status">Status</ZoruLabel>
          <div className="mt-1.5">
            <EnumFormField
              enumName="billStatusV2"
              name="__status_picker"
              initialId={statusValue || null}
              onChange={(id) => onStatusChange(id ?? '')}
            />
          </div>
        </div>
        <div className="md:col-span-2">
          <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaultNotes ?? ''}
            className="mt-1.5"
          />
        </div>
      </div>
    </ZoruCard>
  );
}

export interface RecurringSectionProps {
  enabled: boolean;
  onEnabled: (next: boolean) => void;
  frequency: CrmBillRecurringFrequency | '';
  onFrequency: (next: CrmBillRecurringFrequency | '') => void;
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
                    onFrequency((id ?? '') as CrmBillRecurringFrequency | '')
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

export interface LinkedSectionProps {
  linkedPoId: string | null;
  onLinkedPoId: (next: string | null) => void;
  /** Free-text comma-separated GRN ids (no entity registered today). */
  linkedGrnIds: string;
  onLinkedGrnIds: (next: string) => void;
}

export function LinkedSection({
  linkedPoId,
  onLinkedPoId,
  linkedGrnIds,
  onLinkedGrnIds,
}: LinkedSectionProps) {
  return (
    <ZoruCard className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Linked documents
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ZoruLabel htmlFor="linkedPoId">Linked PO id</ZoruLabel>
          <ZoruInput
            id="linkedPoId"
            value={linkedPoId ?? ''}
            onChange={(e) => onLinkedPoId(e.target.value || null)}
            className="mt-1.5"
            placeholder="Purchase order id"
          />
          <p className="mt-1 text-[11px] text-zoru-ink-muted">
            {/* TODO §1D: surface a proper PO picker once the entity is in
                the lookup registry. */}
            Picker queued — paste an id for now.
          </p>
        </div>
        <div>
          <ZoruLabel htmlFor="linkedGrnIds">Linked GRN ids</ZoruLabel>
          <ZoruInput
            id="linkedGrnIds"
            value={linkedGrnIds}
            onChange={(e) => onLinkedGrnIds(e.target.value)}
            className="mt-1.5"
            placeholder="Comma-separated GRN ids"
          />
        </div>
      </div>
    </ZoruCard>
  );
}
