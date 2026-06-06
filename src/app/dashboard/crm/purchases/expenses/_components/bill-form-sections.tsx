'use client';

import { Card, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
/**
 * Section sub-cards for `<BillForm>`. Hoisted out so the form file
 * stays under the 600-line cap. Each section is presentational —
 * controlled state lives in the parent.
 */

import * as React from 'react';

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
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Header
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="billNo">Bill number</Label>
          <Input
            id="billNo"
            name="billNo"
            defaultValue={defaultBillNo}
            className="mt-1.5"
            placeholder="BILL-2026-0001"
          />
        </div>
        <div>
          <Label htmlFor="vendorInvoiceNo">Vendor invoice number</Label>
          <Input
            id="vendorInvoiceNo"
            name="vendorInvoiceNo"
            defaultValue={defaultVendorInvoiceNo ?? ''}
            className="mt-1.5"
            placeholder="INV-9876"
          />
        </div>
        <div>
          <Label htmlFor="billDate">
            Bill date <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Input
            id="billDate"
            name="billDate"
            type="date"
            required
            defaultValue={defaultBillDate}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Due date</Label>
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaultDueDate}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="placeOfSupply">Place of supply</Label>
          <Input
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
    </Card>
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
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Vendor
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>
            Vendor <span className="text-[var(--st-danger)]">*</span>
          </Label>
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
          <Label>Currency</Label>
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
    </Card>
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
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        TDS
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="tdsSection">TDS section</Label>
          <Input
            id="tdsSection"
            name="tdsSection"
            defaultValue={defaultTdsSection ?? ''}
            className="mt-1.5"
            placeholder="194C"
          />
        </div>
        <div>
          <Label htmlFor="tdsAmount">TDS amount</Label>
          <Input
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
    </Card>
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
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Status &amp; Notes
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="status">Status</Label>
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
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={defaultNotes ?? ''}
            className="mt-1.5"
          />
        </div>
      </div>
    </Card>
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
    <Card className="p-6">
      <details open={enabled}>
        <summary className="cursor-pointer list-none">
          <h3 className="inline text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
              <Label>Frequency</Label>
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
              <Label htmlFor="recurringEnd">End date</Label>
              <Input
                id="recurringEnd"
                type="date"
                value={endDate}
                onChange={(e) => onEndDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="recurringNextRun">Next run</Label>
              <Input
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
    </Card>
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
    <Card className="p-6">
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Linked documents
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="linkedPoId">Linked PO id</Label>
          <Input
            id="linkedPoId"
            value={linkedPoId ?? ''}
            onChange={(e) => onLinkedPoId(e.target.value || null)}
            className="mt-1.5"
            placeholder="Purchase order id"
          />
          <p className="mt-1 text-[11px] text-[var(--st-text-secondary)]">
            {/* TODO §1D: surface a proper PO picker once the entity is in
                the lookup registry. */}
            Picker queued — paste an id for now.
          </p>
        </div>
        <div>
          <Label htmlFor="linkedGrnIds">Linked GRN ids</Label>
          <Input
            id="linkedGrnIds"
            value={linkedGrnIds}
            onChange={(e) => onLinkedGrnIds(e.target.value)}
            className="mt-1.5"
            placeholder="Comma-separated GRN ids"
          />
        </div>
      </div>
    </Card>
  );
}
