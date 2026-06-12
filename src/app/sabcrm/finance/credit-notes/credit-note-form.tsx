'use client';

/**
 * SabCRM Finance — shared credit-note DocForm wiring.
 *
 * The pieces the list client (create) and the detail client (edit) both
 * need so the two drawers can never drift:
 *
 *   - the `extraFields` renderer (linked invoice picker, reason,
 *     refund mode, refund txn id, tax-recalc + auto-apply switches) —
 *     all stored in the kit's `values.extras` bag;
 *   - the base `DocFormConfig` (hide due-date / payment-terms, notes
 *     label, party + item pickers);
 *   - the extras → typed payload reader the submit handlers share.
 */

import * as React from 'react';

import { Field, Input, SelectField, Switch } from '@/components/sabcrm/20ui';
import type {
  CreditNoteReason,
  RefundMode,
} from '@/lib/rust-client/crm-credit-notes';
import {
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { searchSabcrmFinanceInvoiceRefs } from '@/app/actions/sabcrm-finance-pickers.actions';

import {
  EntityPicker,
  formatDocMoney,
  type DocFormConfig,
  type DocFormExtraFieldsApi,
} from '../_components/doc-surface';
import {
  CREDIT_NOTE_REASONS,
  CREDIT_NOTE_REFUND_MODES,
} from './credit-note-config';

/* ─── Extras bag (typed accessors) ────────────────────────────── */

/** What the credit-note form stows in the kit's `values.extras`. */
export interface CreditNoteExtras {
  linkedInvoiceId: string | null;
  linkedInvoiceLabel: string | null;
  reason: CreditNoteReason | null;
  refundMode: RefundMode | null;
  refundTxnId: string;
  taxRecalc: boolean;
  autoApply: boolean;
}

/** Reads the extras bag with safe defaults (kit seeds `{}`). */
export function readCreditNoteExtras(
  extras: Record<string, unknown> | undefined,
): CreditNoteExtras {
  const e = extras ?? {};
  return {
    linkedInvoiceId:
      typeof e.linkedInvoiceId === 'string' ? e.linkedInvoiceId : null,
    linkedInvoiceLabel:
      typeof e.linkedInvoiceLabel === 'string' ? e.linkedInvoiceLabel : null,
    reason: (e.reason as CreditNoteReason | undefined) ?? null,
    refundMode: (e.refundMode as RefundMode | undefined) ?? null,
    refundTxnId: typeof e.refundTxnId === 'string' ? e.refundTxnId : '',
    taxRecalc: e.taxRecalc === true,
    autoApply: e.autoApply === true,
  };
}

/* ─── Extra fields renderer ───────────────────────────────────── */

function CreditNoteExtraFields({
  api,
}: {
  api: DocFormExtraFieldsApi;
}): React.JSX.Element {
  const { values, patch, busy } = api;
  const extras = readCreditNoteExtras(values.extras);

  const patchExtras = (p: Partial<CreditNoteExtras>): void =>
    patch({ extras: { ...values.extras, ...p } });

  return (
    <>
      <Field
        label="Linked invoice"
        help="The invoice this note credits (optional)."
      >
        <EntityPicker
          value={extras.linkedInvoiceId}
          valueLabel={extras.linkedInvoiceLabel}
          search={async (q) => {
            const res = await searchSabcrmFinanceInvoiceRefs(q);
            return res.ok ? res.data : [];
          }}
          placeholder="Search invoices…"
          disabled={busy}
          onChange={(opt) =>
            patchExtras({
              linkedInvoiceId: opt?.id ?? null,
              linkedInvoiceLabel: opt?.label ?? null,
            })
          }
        />
      </Field>

      <Field label="Reason" required>
        <SelectField
          value={extras.reason}
          onChange={(v) =>
            patchExtras({ reason: (v as CreditNoteReason | null) ?? null })
          }
          options={CREDIT_NOTE_REASONS.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
          placeholder="Why is this credit issued?"
          disabled={busy}
        />
      </Field>

      <Field label="Refund mode" required>
        <SelectField
          value={extras.refundMode}
          onChange={(v) =>
            patchExtras({ refundMode: (v as RefundMode | null) ?? null })
          }
          options={CREDIT_NOTE_REFUND_MODES.map((m) => ({
            value: m.value,
            label: m.label,
          }))}
          placeholder="How does the credit flow back?"
          disabled={busy}
        />
      </Field>

      {extras.refundMode === 'cash' ? (
        <Field
          label="Refund transaction id"
          help="UTR / reference of the cash refund (optional)."
        >
          <Input
            value={extras.refundTxnId}
            onChange={(e) => patchExtras({ refundTxnId: e.target.value })}
            placeholder="UTR-…"
            disabled={busy}
          />
        </Field>
      ) : null}

      <div className="fdoc-form-grid__full">
        <Field label="Options">
          <div className="flex flex-col gap-2 pt-1">
            <Switch
              checked={extras.taxRecalc}
              onCheckedChange={(next) => patchExtras({ taxRecalc: next })}
              disabled={busy}
              label="Recompute taxes from line rates"
            />
            <Switch
              checked={extras.autoApply}
              onCheckedChange={(next) => patchExtras({ autoApply: next })}
              disabled={busy}
              label="Auto-apply to the customer's next invoice"
            />
          </div>
        </Field>
      </div>
    </>
  );
}

export function creditNoteExtraFields(
  api: DocFormExtraFieldsApi,
): React.ReactNode {
  return <CreditNoteExtraFields api={api} />;
}

/* ─── Shared DocForm config ───────────────────────────────────── */

/**
 * The credit-note DocForm config both drawers share. Create mode layers
 * `issueLabel` + `suggestNumber` on top.
 */
export function baseCreditNoteFormConfig(): DocFormConfig {
  return {
    entitySingular: 'Credit note',
    numberLabel: 'Credit note number',
    partyLabel: 'Customer',
    partyPlaceholder: 'Search companies & people…',
    dateLabel: 'Credit note date',
    dueDateLabel: 'Due date',
    hideDueDate: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    totalsModifiers: true,
    lineExtras: true,
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
        meta: item.sku
          ? `${item.sku} · ${formatDocMoney(item.sellingPrice, item.currency ?? 'INR')}`
          : formatDocMoney(item.sellingPrice, item.currency ?? 'INR'),
        rate: item.sellingPrice,
        taxRatePct: item.taxRate,
        hsnSac: item.hsnSac,
        description: item.description ?? item.name,
      }));
    },
    extraFields: creditNoteExtraFields,
  };
}

/** Form-level validation the kit can't do (entity-specific fields). */
export function validateCreditNoteExtras(
  extras: CreditNoteExtras,
): string | null {
  if (!extras.reason) return 'Pick a reason for this credit note.';
  if (!extras.refundMode) return 'Pick a refund mode.';
  return null;
}
