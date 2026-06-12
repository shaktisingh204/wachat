'use client';

/**
 * SabCRM Finance — sales-order DocForm wiring (shared by the list
 * client and the detail client so create + edit can never drift).
 *
 * Entity-specific fields (linked quotation / PO no + date / expected
 * shipment / delivery method / internal notes / exchange rate) ride in
 * the kit's `values.extras` bag. The due-date slot is hidden — a sales
 * order has no due date (spec §3.2, `hideDueDate: true`).
 *
 * Edit-mode trap: the Rust `UpdateSalesOrderInput` cannot change
 * `soNo` / `clientId`. The kit form has no per-field lock, so edit mode
 * surfaces a help note and the submit handler rejects changes to either
 * field with a clear error instead of silently dropping them.
 */

import * as React from 'react';

import { Field, Input, SelectField, Textarea } from '@/components/sabcrm/20ui';
import type {
  CrmSalesOrderDeliveryMethod,
  CrmSalesOrderDoc,
} from '@/lib/rust-client/crm-sales-orders';
import type { SabcrmPartyContact } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import {
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { searchSabcrmFinanceQuotationRefs } from '@/app/actions/sabcrm-finance-pickers.actions';
import { getNextSabcrmSalesOrderNumber } from '@/app/actions/sabcrm-finance-sales-orders.actions';
import { SABCRM_SO_DELIVERY_METHODS } from '@/app/actions/sabcrm-finance-sales-orders.actions.types';

import {
  EntityPicker,
  blankDocLine,
  formatDocMoney,
  type DocFormConfig,
  type DocFormValues,
  type DocLineDraft,
} from '../_components/doc-surface';

/* ─── Extras bag (typed access) ───────────────────────────────── */

/** The sales order's entity-specific form extras. */
export interface SalesOrderFormExtras {
  quotationRef: string;
  quotationRefLabel: string;
  poNo: string;
  /** `YYYY-MM-DD`. */
  poDate: string;
  /** `YYYY-MM-DD`. */
  expectedShipmentDate: string;
  deliveryMethod: string;
  internalNotes: string;
  /** Kept as the raw input string; parsed at submit time. */
  exchangeRate: string;
}

/** Read the extras bag defensively (it is `Record<string, unknown>`). */
export function readSalesOrderExtras(
  values: DocFormValues,
): SalesOrderFormExtras {
  const extras = values.extras ?? {};
  const str = (key: string): string =>
    typeof extras[key] === 'string' ? (extras[key] as string) : '';
  return {
    quotationRef: str('quotationRef'),
    quotationRefLabel: str('quotationRefLabel'),
    poNo: str('poNo'),
    poDate: str('poDate'),
    expectedShipmentDate: str('expectedShipmentDate'),
    deliveryMethod: str('deliveryMethod'),
    internalNotes: str('internalNotes'),
    exchangeRate: str('exchangeRate'),
  };
}

/** Parse the exchange-rate input ('' ⇒ undefined; server re-validates). */
export function parseExchangeRate(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return Number(trimmed);
}

/** Narrow a stored extras string into the delivery-method union. */
export function parseDeliveryMethod(
  raw: string,
): CrmSalesOrderDeliveryMethod | undefined {
  return SABCRM_SO_DELIVERY_METHODS.some((m) => m.value === raw)
    ? (raw as CrmSalesOrderDeliveryMethod)
    : undefined;
}

/* ─── Form config ─────────────────────────────────────────────── */

/** The DocForm config both sales-order clients share. */
export function buildSalesOrderFormConfig(opts: {
  mode: 'create' | 'edit';
}): DocFormConfig {
  const editing = opts.mode === 'edit';
  return {
    entitySingular: 'Sales order',
    numberLabel: editing
      ? 'Order number (locked after creation)'
      : 'Order number',
    partyLabel: 'Customer',
    partyPlaceholder: editing
      ? 'Customer is locked after creation'
      : 'Search companies & people…',
    dateLabel: 'Order date',
    dueDateLabel: 'Due date', // unused — hideDueDate below.
    hideDueDate: true,
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
    suggestNumber: editing
      ? undefined
      : async () => {
          const res = await getNextSabcrmSalesOrderNumber();
          return res.ok ? res.data : null;
        },
    totalsModifiers: true,
    lineExtras: true,
    extraFields: ({ values, patch, busy }) => {
      const extras = readSalesOrderExtras(values);
      const setExtras = (next: Partial<SalesOrderFormExtras>): void =>
        patch({ extras: { ...(values.extras ?? {}), ...next } });
      return (
        <>
          <Field
            label="From quotation"
            help="Links the parent quotation (optional)."
          >
            <EntityPicker
              value={extras.quotationRef || null}
              valueLabel={extras.quotationRefLabel || null}
              search={async (q) => {
                const res = await searchSabcrmFinanceQuotationRefs(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search quotations…"
              disabled={busy}
              onChange={(opt) =>
                setExtras({
                  quotationRef: opt?.id ?? '',
                  quotationRefLabel: opt?.label ?? '',
                })
              }
            />
          </Field>
          <Field label="Delivery method">
            <SelectField
              value={extras.deliveryMethod || null}
              onChange={(v) => setExtras({ deliveryMethod: v ?? '' })}
              options={SABCRM_SO_DELIVERY_METHODS.map((m) => ({
                value: m.value,
                label: m.label,
              }))}
              placeholder="Select method"
              disabled={busy}
            />
          </Field>
          <Field label="Customer PO no.">
            <Input
              value={extras.poNo}
              onChange={(e) => setExtras({ poNo: e.target.value })}
              placeholder="PO-1042"
              disabled={busy}
            />
          </Field>
          <Field label="Customer PO date">
            <Input
              type="date"
              value={extras.poDate}
              onChange={(e) => setExtras({ poDate: e.target.value })}
              disabled={busy}
            />
          </Field>
          <Field
            label="Expected shipment"
            help="Drives the due-to-ship KPI."
          >
            <Input
              type="date"
              value={extras.expectedShipmentDate}
              onChange={(e) =>
                setExtras({ expectedShipmentDate: e.target.value })
              }
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
              onChange={(e) => setExtras({ exchangeRate: e.target.value })}
              placeholder="1.00"
              disabled={busy}
            />
          </Field>
          <div className="fdoc-form-grid__full">
            <Field
              label="Internal notes"
              help="Visible to your team only — never printed."
            >
              <Textarea
                value={extras.internalNotes}
                onChange={(e) => setExtras({ internalNotes: e.target.value })}
                rows={2}
                placeholder="Ship from the Pune warehouse."
                disabled={busy}
              />
            </Field>
          </div>
        </>
      );
    },
  };
}

/* ─── Doc → form seed (edit mode) ─────────────────────────────── */

/** Sales-order doc → DocForm seed (labels cached so ids never render). */
export function salesOrderToFormValues(
  doc: CrmSalesOrderDoc,
  contact: SabcrmPartyContact | null,
  quotationLabel: string | null,
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
    number: doc.soNo,
    partyId: doc.clientId || null,
    partyLabel: contact?.label ?? null,
    currency: doc.currency,
    date: (doc.date ?? '').slice(0, 10),
    dueDate: '',
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: doc.paymentTerms ?? '',
    customerNotes: doc.customerNotes ?? '',
    termsAndConditions: '',
    attachments: [],
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
    extras: {
      quotationRef: doc.quotationRef ?? '',
      quotationRefLabel: quotationLabel ?? (doc.quotationRef ? 'Quotation' : ''),
      poNo: doc.poNo ?? '',
      poDate: (doc.poDate ?? '').slice(0, 10),
      expectedShipmentDate: (doc.expectedShipmentDate ?? '').slice(0, 10),
      deliveryMethod: doc.deliveryMethod ?? '',
      internalNotes: doc.internalNotes ?? '',
      exchangeRate:
        doc.exchangeRate !== undefined ? String(doc.exchangeRate) : '',
    },
  };
}
