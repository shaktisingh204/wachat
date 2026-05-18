'use client';

/**
 * <QuotationFormSections> — the top-of-form sections of
 * `<QuotationForm>` (Header · Customer · Subject · Notes). Extracted
 * to keep the parent under the 600-line cap. Pure presentation; the
 * parent owns dirty tracking, pipeline state, and the currency
 * selection.
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
    <ZoruCard className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-zoru-ink">Header</h2>
        <p className="text-[12.5px] text-zoru-ink-muted">
          Quotation number, date, and validity window.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="quotationNo">
            Quotation # <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="quotationNo"
            name="quotationNo"
            required
            defaultValue={initial?.quotationNo ?? ''}
            placeholder="QT-2026-0042"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="date">
            Date <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="date"
            name="date"
            type="date"
            required
            defaultValue={toIsoDate(initial?.date)}
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="validUntil">
            Valid until <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <ZoruInput
            id="validUntil"
            name="validUntil"
            type="date"
            required
            defaultValue={toIsoDate(initial?.validUntil)}
          />
        </div>
      </div>
    </ZoruCard>
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
    <ZoruCard className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-zoru-ink">Customer</h2>
        <p className="text-[12.5px] text-zoru-ink-muted">
          Client, reference, sales agent, and source deal.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <ZoruLabel>
            Customer <span className="text-zoru-danger-ink">*</span>
          </ZoruLabel>
          <EntityFormField
            entity="client"
            name="clientId"
            initialId={initial?.clientId ?? null}
            required
            onChange={onAnyChange}
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="referenceNo">Reference #</ZoruLabel>
          <ZoruInput
            id="referenceNo"
            name="referenceNo"
            defaultValue={initial?.referenceNo ?? ''}
            placeholder="PO-2026-0921"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel>Sales agent</ZoruLabel>
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
          <ZoruLabel>Pipeline</ZoruLabel>
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
          <ZoruLabel>Deal</ZoruLabel>
          <EntityFormField
            entity="deal"
            name="dealId"
            initialId={initial?.dealId ?? null}
            filter={pipelineId ? { pipelineId } : undefined}
            onChange={onAnyChange}
          />
        </div>
      </div>
    </ZoruCard>
  );
}

/* ─── Subject + place of supply + currency + status ───────────── */

interface QuotationSubjectSectionProps {
  initial?: CrmQuotationDoc | null;
  editing: boolean;
  onCurrencyChange: (next: string) => void;
  onAnyChange: () => void;
}

export function QuotationSubjectSection({
  initial,
  editing,
  onCurrencyChange,
  onAnyChange,
}: QuotationSubjectSectionProps) {
  return (
    <ZoruCard className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-zoru-ink">Subject</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="subject">Subject</ZoruLabel>
          <ZoruInput
            id="subject"
            name="subject"
            defaultValue={initial?.subject ?? ''}
            placeholder="Q3 hosting renewal"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="placeOfSupply">Place of supply</ZoruLabel>
          <ZoruInput
            id="placeOfSupply"
            name="placeOfSupply"
            defaultValue={initial?.placeOfSupply ?? ''}
            placeholder="State code (GST)"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel>Currency</ZoruLabel>
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
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <EnumFormField
              enumName="quotationStatusV2"
              name="status"
              initialId={(initial?.status ?? 'draft') as string}
            />
          </div>
        ) : null}
      </div>
    </ZoruCard>
  );
}

/* ─── Terms + Customer notes ─────────────────────────────────── */

export function QuotationNotesSection({
  initial,
}: {
  initial?: CrmQuotationDoc | null;
}) {
  return (
    <ZoruCard className="space-y-4 p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-zoru-ink">Notes</h2>
      </div>
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="termsAndConditions">Terms &amp; conditions</ZoruLabel>
          <ZoruTextarea
            id="termsAndConditions"
            name="termsAndConditions"
            defaultValue={initial?.termsAndConditions ?? ''}
            placeholder="Net 30. Prices in INR…"
            className="min-h-[88px]"
          />
        </div>
        <div className="space-y-1.5">
          <ZoruLabel htmlFor="notes">Customer notes</ZoruLabel>
          <ZoruTextarea
            id="notes"
            name="notes"
            defaultValue={initial?.customerNotes ?? ''}
            placeholder="Pricing valid till month-end."
            className="min-h-[72px]"
          />
        </div>
      </div>
    </ZoruCard>
  );
}
