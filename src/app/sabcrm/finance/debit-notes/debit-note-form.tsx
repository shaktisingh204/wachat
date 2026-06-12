'use client';

/**
 * SabCRM Finance — shared debit-note DocForm wiring.
 *
 * The pieces the list client (create) and the detail client (edit) both
 * need so the two drawers can never drift: the `extraFields` renderer
 * (linked bill picker, reason, refund mode, refund txn id), the base
 * `DocFormConfig` (vendor party picker, supply-item picker, hide
 * due-date / payment-terms) and the extras → typed payload reader.
 */

import * as React from 'react';

import { Field, Input, SelectField } from '@/components/sabcrm/20ui';
import type {
  DebitNoteReason,
  DebitNoteRefundMode,
} from '@/lib/rust-client/crm-debit-notes';
import { searchSabcrmFinanceItems } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  searchSabcrmFinanceBillRefs,
  searchSabcrmFinanceVendors,
} from '@/app/actions/sabcrm-finance-pickers.actions';

import {
  EntityPicker,
  formatDocMoney,
  type DocFormConfig,
  type DocFormExtraFieldsApi,
} from '../_components/doc-surface';
import {
  DEBIT_NOTE_REASONS,
  DEBIT_NOTE_REFUND_MODES,
} from './debit-note-config';

/* ─── Extras bag (typed accessors) ────────────────────────────── */

/** What the debit-note form stows in the kit's `values.extras`. */
export interface DebitNoteExtras {
  linkedBillId: string | null;
  linkedBillLabel: string | null;
  reason: DebitNoteReason | null;
  refundMode: DebitNoteRefundMode | null;
  refundTxnId: string;
}

/** Reads the extras bag with safe defaults (kit seeds `{}`). */
export function readDebitNoteExtras(
  extras: Record<string, unknown> | undefined,
): DebitNoteExtras {
  const e = extras ?? {};
  return {
    linkedBillId: typeof e.linkedBillId === 'string' ? e.linkedBillId : null,
    linkedBillLabel:
      typeof e.linkedBillLabel === 'string' ? e.linkedBillLabel : null,
    reason: (e.reason as DebitNoteReason | undefined) ?? null,
    refundMode: (e.refundMode as DebitNoteRefundMode | undefined) ?? null,
    refundTxnId: typeof e.refundTxnId === 'string' ? e.refundTxnId : '',
  };
}

/* ─── Extra fields renderer ───────────────────────────────────── */

function DebitNoteExtraFields({
  api,
}: {
  api: DocFormExtraFieldsApi;
}): React.JSX.Element {
  const { values, patch, busy } = api;
  const extras = readDebitNoteExtras(values.extras);

  const patchExtras = (p: Partial<DebitNoteExtras>): void =>
    patch({ extras: { ...values.extras, ...p } });

  return (
    <>
      <Field label="Linked bill" help="The bill this note debits (optional).">
        <EntityPicker
          value={extras.linkedBillId}
          valueLabel={extras.linkedBillLabel}
          search={async (q) => {
            const res = await searchSabcrmFinanceBillRefs(q);
            return res.ok ? res.data : [];
          }}
          placeholder="Search bills…"
          disabled={busy}
          onChange={(opt) =>
            patchExtras({
              linkedBillId: opt?.id ?? null,
              linkedBillLabel: opt?.label ?? null,
            })
          }
        />
      </Field>

      <Field label="Reason" required>
        <SelectField
          value={extras.reason}
          onChange={(v) =>
            patchExtras({ reason: (v as DebitNoteReason | null) ?? null })
          }
          options={DEBIT_NOTE_REASONS.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
          placeholder="Why is this debit raised?"
          disabled={busy}
        />
      </Field>

      <Field label="Refund mode" required>
        <SelectField
          value={extras.refundMode}
          onChange={(v) =>
            patchExtras({
              refundMode: (v as DebitNoteRefundMode | null) ?? null,
            })
          }
          options={DEBIT_NOTE_REFUND_MODES.map((m) => ({
            value: m.value,
            label: m.label,
          }))}
          placeholder="How does the value flow back?"
          disabled={busy}
        />
      </Field>

      {extras.refundMode === 'cash' ? (
        <Field
          label="Refund transaction id"
          help="UTR / reference of the vendor's refund (optional)."
        >
          <Input
            value={extras.refundTxnId}
            onChange={(e) => patchExtras({ refundTxnId: e.target.value })}
            placeholder="UTR-…"
            disabled={busy}
          />
        </Field>
      ) : null}
    </>
  );
}

export function debitNoteExtraFields(
  api: DocFormExtraFieldsApi,
): React.ReactNode {
  return <DebitNoteExtraFields api={api} />;
}

/* ─── Shared DocForm config ───────────────────────────────────── */

/**
 * The debit-note DocForm config both drawers share. Create mode layers
 * `issueLabel` + `suggestNumber` on top.
 */
export function baseDebitNoteFormConfig(): DocFormConfig {
  return {
    entitySingular: 'Debit note',
    numberLabel: 'Debit note number',
    partyLabel: 'Vendor',
    partyPlaceholder: 'Search vendors…',
    dateLabel: 'Debit note date',
    dueDateLabel: 'Due date',
    hideDueDate: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    totalsModifiers: true,
    lineExtras: true,
    searchParties: async (q) => {
      const res = await searchSabcrmFinanceVendors(q);
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
    extraFields: debitNoteExtraFields,
  };
}

/** Form-level validation the kit can't do (entity-specific fields). */
export function validateDebitNoteExtras(
  extras: DebitNoteExtras,
): string | null {
  if (!extras.reason) return 'Pick a reason for this debit note.';
  if (!extras.refundMode) return 'Pick a refund mode.';
  return null;
}
