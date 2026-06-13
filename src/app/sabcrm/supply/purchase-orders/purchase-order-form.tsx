'use client';

/**
 * SabCRM Supply — purchase-order DocForm wiring (shared by the list
 * client and the detail client so create + edit can never drift).
 *
 * DocForm fits the PO natively (rollout WI-5): the kit's party slot is
 * the VENDOR, the due-date slot is "Expected delivery", line items are
 * real supply catalog items with server-recomputed totals. The only
 * entity-specific header field is the ship-to warehouse, rendered
 * through `DocFormConfig.extraFields` (a real `EntityPicker` over the
 * warehouses mount — never a free-text id). Its label is cached in
 * `values.extraLabels` so a re-opened edit form never shows an id.
 */

import * as React from 'react';

import { Field } from '@/components/sabcrm/20ui';
import type { CrmPurchaseOrderDoc } from '@/lib/rust-client/sabcrm-supply';
import {
  searchSabcrmSupplyItemOptions,
  searchSabcrmSupplyVendors,
  searchSabcrmSupplyWarehouses,
  suggestNextSupplyNumber,
} from '@/app/actions/sabcrm-supply-docs.actions';

import {
  EntityPicker,
  blankDocLine,
  formatDocMoney,
  type DocFormConfig,
  type DocFormValues,
  type DocLineDraft,
} from '../../finance/_components/doc-surface';

/* ─── Extras bag (typed access) ───────────────────────────────── */

/** The PO's entity-specific form extras. */
export interface PoFormExtras {
  /** REAL picked ship-to warehouse id (or '' when none). */
  shipToWarehouseId: string;
  /** Cached label so a re-opened edit form never shows an id. */
  shipToWarehouseLabel: string;
}

/** Read the extras bag defensively (it is `Record<string, unknown>`). */
export function readPoExtras(values: DocFormValues): PoFormExtras {
  const extras = values.extras ?? {};
  return {
    shipToWarehouseId:
      typeof extras.shipToWarehouseId === 'string'
        ? extras.shipToWarehouseId
        : '',
    shipToWarehouseLabel:
      typeof extras.shipToWarehouseLabel === 'string'
        ? extras.shipToWarehouseLabel
        : '',
  };
}

/* ─── Form config ─────────────────────────────────────────────── */

/** The DocForm config both PO clients share. */
export function buildPurchaseOrderFormConfig(opts: {
  /** Show the "Save & send" split (create mode only). */
  withIssue: boolean;
}): DocFormConfig {
  return {
    entitySingular: 'Purchase order',
    numberLabel: 'PO number',
    partyLabel: 'Vendor',
    partyPlaceholder: 'Search vendors…',
    dateLabel: 'Order date',
    dueDateLabel: 'Expected delivery',
    issueLabel: opts.withIssue ? 'Save & send' : undefined,
    searchParties: async (q) => {
      const res = await searchSabcrmSupplyVendors(q);
      return res.ok ? res.data : [];
    },
    searchItems: async (q) => {
      const res = await searchSabcrmSupplyItemOptions(q);
      if (!res.ok) return [];
      return res.data.map((item) => ({
        id: item.id,
        label: item.label,
        meta: item.meta
          ? `${item.meta}${
              item.rate !== undefined
                ? ` · ${formatDocMoney(item.rate, 'INR')}`
                : ''
            }`
          : item.rate !== undefined
            ? formatDocMoney(item.rate, 'INR')
            : undefined,
        rate: item.rate,
        taxRatePct: item.taxRatePct,
        hsnSac: item.hsnSac,
        description: item.description ?? item.label,
      }));
    },
    suggestNumber: opts.withIssue
      ? async () => {
          const res = await suggestNextSupplyNumber('purchase-order');
          return res.ok ? res.data : null;
        }
      : undefined,
    totalsModifiers: true,
    lineExtras: true,
    extraFields: ({ values, patch, busy }) => {
      const extras = readPoExtras(values);
      return (
        <div className="fdoc-form-grid__full">
          <Field
            label="Ship-to warehouse"
            help="Where these goods will be received."
          >
            <EntityPicker
              value={extras.shipToWarehouseId || null}
              valueLabel={extras.shipToWarehouseLabel || null}
              search={async (q) => {
                const res = await searchSabcrmSupplyWarehouses(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search warehouses…"
              disabled={busy}
              onChange={(opt) =>
                patch({
                  extras: {
                    ...(values.extras ?? {}),
                    shipToWarehouseId: opt?.id ?? '',
                    shipToWarehouseLabel: opt?.label ?? '',
                  },
                })
              }
            />
          </Field>
        </div>
      );
    },
  };
}

/* ─── Doc → form seed (edit mode) ─────────────────────────────── */

/** PO doc → DocForm seed (labels cached so ids never render). */
export function purchaseOrderToFormValues(
  doc: CrmPurchaseOrderDoc,
  vendorLabel: string | null,
  warehouseLabel: string | null,
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
    number: doc.poNo,
    partyId: doc.vendorId || null,
    partyLabel: vendorLabel,
    currency: doc.currency || 'INR',
    date: (doc.date ?? '').slice(0, 10),
    dueDate: (doc.expectedDelivery ?? '').slice(0, 10),
    lines: lines.length > 0 ? lines : [blankDocLine()],
    paymentTerms: doc.paymentTerms ?? '',
    customerNotes: doc.notes ?? '',
    termsAndConditions: doc.termsAndConditions ?? '',
    attachments: [],
    modifiers: {
      discountOverall: doc.totals?.discountOverall || undefined,
      shippingCharge: doc.totals?.shippingCharge || undefined,
      adjustment: doc.totals?.adjustment || undefined,
      roundOff: !!doc.totals?.roundOff,
    },
    extras: {
      shipToWarehouseId: doc.shipToWarehouseId ?? '',
      shipToWarehouseLabel: warehouseLabel ?? '',
    },
  };
}
