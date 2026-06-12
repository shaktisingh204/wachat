'use client';

/**
 * SabCRM Finance — proforma DocForm wiring (shared by the list client
 * and the detail client so create + edit can never drift).
 *
 * Mounted-shape notes (finance-rollout spec §3.3):
 *   - the due-date slot is relabelled "Valid till";
 *   - the payment-terms input is hidden (`hidePaymentTerms` — the
 *     legacy shape has no slot for it); terms & conditions is a
 *     newline-split `string[]` on the wire;
 *   - the notes textarea is relabelled "Notes" (`notesLabel`);
 *   - line `hsnSac` has no wire slot, so `lineExtras` stays off;
 *   - the G3 advance fields (linked SO / advance % / advance amount /
 *     payment due / expected delivery) ride in `values.extras`.
 */

import * as React from 'react';

import { Field, Input } from '@/components/sabcrm/20ui';
import type { CrmProformaInvoiceDoc } from '@/lib/rust-client/crm-proforma-invoices';
import type { SabcrmPartyContact } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import {
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { searchSabcrmFinanceSalesOrderRefs } from '@/app/actions/sabcrm-finance-pickers.actions';
import { getNextSabcrmProformaNumber } from '@/app/actions/sabcrm-finance-proforma.actions';

import {
  EntityPicker,
  blankDocLine,
  formatDocMoney,
  type DocFormConfig,
  type DocFormValues,
  type DocLineDraft,
} from '../_components/doc-surface';

/* ─── Extras bag (typed access) ───────────────────────────────── */

/** The proforma's entity-specific form extras (G3 advance fields). */
export interface ProformaFormExtras {
  linkedSoId: string;
  linkedSoLabel: string;
  /** Raw input strings; parsed at submit time. */
  advancePct: string;
  advanceAmount: string;
  /** `YYYY-MM-DD`. */
  paymentDueDate: string;
  /** `YYYY-MM-DD`. */
  expectedDelivery: string;
}

/** Read the extras bag defensively (it is `Record<string, unknown>`). */
export function readProformaExtras(values: DocFormValues): ProformaFormExtras {
  const extras = values.extras ?? {};
  const str = (key: string): string =>
    typeof extras[key] === 'string' ? (extras[key] as string) : '';
  return {
    linkedSoId: str('linkedSoId'),
    linkedSoLabel: str('linkedSoLabel'),
    advancePct: str('advancePct'),
    advanceAmount: str('advanceAmount'),
    paymentDueDate: str('paymentDueDate'),
    expectedDelivery: str('expectedDelivery'),
  };
}

/** Parse a numeric extras input ('' ⇒ undefined; server re-validates). */
export function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

/* ─── Form config ─────────────────────────────────────────────── */

/** The DocForm config both proforma clients share. */
export function buildProformaFormConfig(opts: {
  /** Show the "Save & issue" split (create mode only). */
  withIssue: boolean;
}): DocFormConfig {
  return {
    entitySingular: 'Proforma invoice',
    numberLabel: 'Proforma number',
    partyLabel: 'Customer',
    partyPlaceholder: 'Search companies & people…',
    dateLabel: 'Proforma date',
    dueDateLabel: 'Valid till',
    issueLabel: opts.withIssue ? 'Save & issue' : undefined,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
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
        description: item.description ?? item.name,
      }));
    },
    suggestNumber: opts.withIssue
      ? async () => {
          const res = await getNextSabcrmProformaNumber();
          return res.ok ? res.data : null;
        }
      : undefined,
    extraFields: ({ values, patch, busy }) => {
      const extras = readProformaExtras(values);
      const setExtras = (next: Partial<ProformaFormExtras>): void =>
        patch({ extras: { ...(values.extras ?? {}), ...next } });
      return (
        <>
          <Field
            label="Linked sales order"
            help="Marks this proforma as an advance request (optional)."
          >
            <EntityPicker
              value={extras.linkedSoId || null}
              valueLabel={extras.linkedSoLabel || null}
              search={async (q) => {
                const res = await searchSabcrmFinanceSalesOrderRefs(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search sales orders…"
              disabled={busy}
              onChange={(opt) =>
                setExtras({
                  linkedSoId: opt?.id ?? '',
                  linkedSoLabel: opt?.label ?? '',
                })
              }
            />
          </Field>
          <Field
            label="Advance %"
            help="Without an amount, the ask is derived from the total."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={extras.advancePct}
              onChange={(e) => setExtras({ advancePct: e.target.value })}
              placeholder="25"
              disabled={busy}
            />
          </Field>
          <Field label="Advance amount" help="Overrides the % when set.">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={extras.advanceAmount}
              onChange={(e) => setExtras({ advanceAmount: e.target.value })}
              placeholder="0.00"
              disabled={busy}
            />
          </Field>
          <Field label="Advance due date">
            <Input
              type="date"
              value={extras.paymentDueDate}
              onChange={(e) => setExtras({ paymentDueDate: e.target.value })}
              disabled={busy}
            />
          </Field>
          <Field label="Expected delivery">
            <Input
              type="date"
              value={extras.expectedDelivery}
              onChange={(e) => setExtras({ expectedDelivery: e.target.value })}
              disabled={busy}
            />
          </Field>
        </>
      );
    },
  };
}

/* ─── Doc → form seed (edit mode) ─────────────────────────────── */

/** Proforma doc → DocForm seed (legacy line shape mapped to kit lines). */
export function proformaToFormValues(
  doc: CrmProformaInvoiceDoc,
  contact: SabcrmPartyContact | null,
  linkedSoLabel: string | null,
): DocFormValues {
  const lines: DocLineDraft[] = (doc.lineItems ?? []).map((item, i) => ({
    rowId: `seed-${i}`,
    itemId: item.itemId,
    itemLabel: item.itemId ? (item.description ?? 'Catalog item') : null,
    description: item.description ?? '',
    qty: item.quantity,
    unit: item.unit,
    rate: item.rate,
    taxRatePct: item.taxPct,
  }));
  return {
    number: doc.proformaNumber,
    partyId: doc.accountId || null,
    partyLabel: contact?.label ?? null,
    currency: doc.currency || 'INR',
    date: (doc.proformaDate ?? '').slice(0, 10),
    dueDate: (doc.validTillDate ?? '').slice(0, 10),
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: '',
    customerNotes: doc.notes ?? '',
    termsAndConditions: (doc.termsAndConditions ?? []).join('\n'),
    attachments: [],
    extras: {
      linkedSoId: doc.linkedSoId ?? '',
      linkedSoLabel: linkedSoLabel ?? (doc.linkedSoId ? 'Sales order' : ''),
      advancePct:
        doc.advancePct !== undefined ? String(doc.advancePct) : '',
      advanceAmount:
        doc.advanceAmount !== undefined ? String(doc.advanceAmount) : '',
      paymentDueDate: (doc.paymentDueDate ?? '').slice(0, 10),
      expectedDelivery: (doc.expectedDelivery ?? '').slice(0, 10),
    },
  };
}
