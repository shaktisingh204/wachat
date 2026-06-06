'use client';

import { Card, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
/**
 * <QuotationFormSections> — the top-of-form sections of
 * `<QuotationForm>` (Header · Customer · Subject · Notes). Extracted
 * to keep the parent under the 600-line cap. Pure presentation; the
 * parent owns dirty tracking, pipeline state, and the currency
 * selection.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import type {
  CrmQuotationDoc,
} from '@/lib/rust-client/crm-quotations';

// Status options now sourced from CRM_ENUMS.quotationStatusV2.

function toIsoDate(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/* ─── Header section ──────────────────────────────────────────── */

export function QuotationHeaderSection({
  initial,
}: {
  initial?: CrmQuotationDoc | null;
}) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Header</h2>
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
          Quotation number, date, and validity window.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quotationNo">
            Quotation # <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Input
            id="quotationNo"
            name="quotationNo"
            required
            defaultValue={initial?.quotationNo ?? ''}
            placeholder="QT-2026-0042"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">
            Date <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={toIsoDate(initial?.date)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validUntil">
            Valid until <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <Input
            id="validUntil"
            name="validUntil"
            type="date"
            required
            defaultValue={toIsoDate(initial?.validUntil)}
          />
        </div>
      </div>
    </Card>
  );
}

/* ─── Customer section ────────────────────────────────────────── */

interface QuotationCustomerSectionProps {
  initial?: CrmQuotationDoc | null;
  pipelineId: string | null;
  onPipelineChange: (next: string | null) => void;
  onAnyChange: () => void;
}

export function QuotationCustomerSection({
  initial,
  pipelineId,
  onPipelineChange,
  onAnyChange,
}: QuotationCustomerSectionProps) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Customer</h2>
        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
          Client, reference, sales agent, and source deal.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Customer <span className="text-[var(--st-danger)]">*</span>
          </Label>
          <EntityFormField
            entity="client"
            name="clientId"
            initialId={initial?.clientId ?? null}
            required
            onChange={onAnyChange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="referenceNo">Reference #</Label>
          <Input
            id="referenceNo"
            name="referenceNo"
            defaultValue={initial?.referenceNo ?? ''}
            placeholder="PO-2026-0921"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sales agent</Label>
          <EntityFormField
            entity="user"
            name="salesAgentId"
            initialId={
              initial?.assignment?.assignedTo ?? initial?.salesAgentId ?? null
            }
            onChange={onAnyChange}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Pipeline</Label>
          <EntityFormField
            entity="pipeline"
            name="pipelineId"
            initialId={null}
            onChange={(next) => {
              onPipelineChange(next);
              onAnyChange();
            }}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Deal</Label>
          <EntityFormField
            entity="deal"
            name="dealId"
            initialId={initial?.dealId ?? null}
            filter={pipelineId ? { pipelineId } : undefined}
            onChange={onAnyChange}
          />
        </div>
      </div>
    </Card>
  );
}

/* ─── Subject + place of supply + currency + status ───────────── */

interface QuotationSubjectSectionProps {
  initial?: CrmQuotationDoc | null;
  editing: boolean;
  onCurrencyChange: (next: string) => void;
  onAnyChange: () => void;
  placeOfSupply: string;
  onPlaceOfSupplyChange: (next: string) => void;
}

export function QuotationSubjectSection({
  initial,
  editing,
  onCurrencyChange,
  onAnyChange,
  placeOfSupply,
  onPlaceOfSupplyChange,
}: QuotationSubjectSectionProps) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Subject</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            defaultValue={initial?.subject ?? ''}
            placeholder="Q3 hosting renewal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="placeOfSupply">Place of supply</Label>
          <Input
            id="placeOfSupply"
            name="placeOfSupply"
            value={placeOfSupply}
            onChange={(e) => {
              onPlaceOfSupplyChange(e.target.value);
              onAnyChange();
            }}
            placeholder="State code (GST)"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <EntityFormField
            entity="currency"
            name="currency"
            initialId={initial?.currency ?? 'INR'}
            onChange={(next) => {
              onCurrencyChange(next ?? 'INR');
              onAnyChange();
            }}
          />
        </div>
        {editing ? (
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <EnumFormField
              enumName="quotationStatusV2"
              name="status"
              initialId={(initial?.status ?? 'draft') as string}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ─── Terms + Customer notes ─────────────────────────────────── */

export function QuotationNotesSection({
  initial,
}: {
  initial?: CrmQuotationDoc | null;
}) {
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">Notes</h2>
      </div>
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
          <Textarea
            id="termsAndConditions"
            name="termsAndConditions"
            defaultValue={initial?.termsAndConditions ?? ''}
            placeholder="Net 30. Prices in INR…"
            className="min-h-[88px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Customer notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={initial?.customerNotes ?? ''}
            placeholder="Pricing valid till month-end."
            className="min-h-[72px]"
          />
        </div>
      </div>
    </Card>
  );
}
