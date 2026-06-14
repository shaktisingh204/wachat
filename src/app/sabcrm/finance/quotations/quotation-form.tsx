'use client';

/**
 * SabCRM Finance — quotation DocForm wiring (shared by the list client
 * and the detail client so create + edit can never drift).
 *
 * Entity-specific fields (subject / reference no / exchange rate) ride
 * in the kit's `values.extras` bag and render through
 * `DocFormConfig.extraFields`; place-of-supply uses the built-in
 * tax-fields slot. The kit's due-date slot is relabelled "Valid until"
 * (spec §3.1).
 */

import * as React from 'react';

import { Field, Input } from '@/components/sabcrm/20ui';
import type { CrmQuotationDoc } from '@/lib/rust-client/crm-quotations';
import type { SabcrmPartyContact } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import {
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { getNextSabcrmQuotationNumber } from '@/app/actions/sabcrm-finance-quotations.actions';

import {
  blankDocLine,
  formatDocMoney,
  type DocFormConfig,
  type DocFormValues,
  type DocLineDraft,
} from '../_components/doc-surface';
import { QuotePricingPreview } from './quote-pricing-preview';

/* ─── Extras bag (typed access) ───────────────────────────────── */

/** The quotation's entity-specific form extras. */
export interface QuotationFormExtras {
  subject: string;
  referenceNo: string;
  /** Kept as the raw input string; parsed at submit time. */
  exchangeRate: string;
}

/** Read the extras bag defensively (it is `Record<string, unknown>`). */
export function readQuotationExtras(values: DocFormValues): QuotationFormExtras {
  const extras = values.extras ?? {};
  return {
    subject: typeof extras.subject === 'string' ? extras.subject : '',
    referenceNo:
      typeof extras.referenceNo === 'string' ? extras.referenceNo : '',
    exchangeRate:
      typeof extras.exchangeRate === 'string' ? extras.exchangeRate : '',
  };
}

/** Parse the exchange-rate input ('' ⇒ undefined; server re-validates). */
export function parseExchangeRate(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

/* ─── Form config ─────────────────────────────────────────────── */

/** The DocForm config both quotation clients share. */
export function buildQuotationFormConfig(opts: {
  /** Show the "Save & send" split (create mode only). */
  withIssue: boolean;
}): DocFormConfig {
  return {
    entitySingular: 'Quotation',
    numberLabel: 'Quotation number',
    partyLabel: 'Customer',
    partyPlaceholder: 'Search companies & people…',
    dateLabel: 'Quotation date',
    dueDateLabel: 'Valid until',
    issueLabel: opts.withIssue ? 'Save & send' : undefined,
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
    suggestNumber: opts.withIssue
      ? async () => {
          const res = await getNextSabcrmQuotationNumber();
          return res.ok ? res.data : null;
        }
      : undefined,
    taxFields: { placeOfSupply: true },
    totalsModifiers: true,
    lineExtras: true,
    extraFields: ({ values, patch, busy }) => {
      const extras = readQuotationExtras(values);
      const setExtra = (key: keyof QuotationFormExtras, value: string): void =>
        patch({ extras: { ...(values.extras ?? {}), [key]: value } });
      return (
        <>
          <div className="fdoc-form-grid__full">
            <Field label="Subject" help="Short headline above the items table.">
              <Input
                value={extras.subject}
                onChange={(e) => setExtra('subject', e.target.value)}
                placeholder="Q3 hosting renewal"
                disabled={busy}
              />
            </Field>
          </div>
          <Field label="Reference no.">
            <Input
              value={extras.referenceNo}
              onChange={(e) => setExtra('referenceNo', e.target.value)}
              placeholder="REF-0042"
              disabled={busy}
            />
          </Field>
          <Field
            label="Exchange rate"
            help="Vs your base currency. Leave blank for 1:1."
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.0001"
              value={extras.exchangeRate}
              onChange={(e) => setExtra('exchangeRate', e.target.value)}
              placeholder="1.00"
              disabled={busy}
            />
          </Field>
          <QuotePricingPreview values={values} patch={patch} busy={busy} />
        </>
      );
    },
  };
}

/* ─── Doc → form seed (edit mode) ─────────────────────────────── */

/** Quotation doc → DocForm seed (labels cached so ids never render). */
export function quotationToFormValues(
  doc: CrmQuotationDoc,
  contact: SabcrmPartyContact | null,
): DocFormValues {
  const lines: DocLineDraft[] = (doc.items ?? []).map((item, i) => ({
    rowId: `seed-${i}`,
    itemId: item.itemId,
    itemLabel: item.itemId ? (item.description ?? 'Catalog item') : null,
    description: item.description ?? '',
    hsnSac: item.hsnSac,
    qty: item.qty,
    unit: item.unit,
    rate: item.rate,
    discountPct: item.discountPct,
    taxRatePct: item.taxRatePct,
  }));
  return {
    number: doc.quotationNo,
    partyId: doc.clientId || null,
    partyLabel: contact?.label ?? null,
    currency: doc.currency,
    date: (doc.date ?? '').slice(0, 10),
    dueDate: (doc.validUntil ?? '').slice(0, 10),
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: '',
    customerNotes: doc.customerNotes ?? '',
    termsAndConditions: doc.termsAndConditions ?? '',
    attachments: (doc.attachments ?? []).map((a) => ({
      fileId: a.fileId,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    placeOfSupply: doc.placeOfSupply ?? '',
    gstTreatment: null,
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
    extras: {
      subject: doc.subject ?? '',
      referenceNo: doc.referenceNo ?? '',
      exchangeRate:
        doc.exchangeRate !== undefined ? String(doc.exchangeRate) : '',
    },
  };
}
