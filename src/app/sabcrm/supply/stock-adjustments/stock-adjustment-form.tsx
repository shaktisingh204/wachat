'use client';

/**
 * SabCRM Supply — stock-adjustment DocForm wiring (shared by the list
 * client and the detail client so create + edit never drift).
 *
 * The adjustment has no finance party, no line items, no due date and
 * no payment terms — it runs with `hideLines`, `hideDueDate`,
 * `hidePaymentTerms`. The kit's party slot is repurposed as the
 * required WAREHOUSE (a REAL `EntityPicker` over the warehouses mount).
 * Reason, product, signed quantity, reference, cost-per-unit and notes
 * live in `extraFields` / `values.extras`. The crate requires a single
 * product/quantity header (multi-line `lines[]` is a documented
 * fast-follow), so v1 keeps the header shape.
 */

import * as React from 'react';

import { Field, Input } from '@/components/sabcrm/20ui';

import {
  EntityPicker,
  emptyDocFormValues,
  type DocFormConfig,
  type DocFormValues,
} from '../../finance/_components/doc-surface';
import {
  searchSabcrmSupplyItemOptions,
  searchSabcrmSupplyWarehouses,
  suggestNextSupplyNumber,
} from '@/app/actions/sabcrm-supply-docs.actions';
import type { SabcrmSupplyStockAdjustmentFullInput } from '@/app/actions/sabcrm-supply-stock-adjustments.actions.types';
import type { CrmStockAdjustmentDoc } from '@/lib/rust-client/crm-stock-adjustments';

/* ─── Extras bag (typed access) ───────────────────────────────────── */

export interface AdjustmentExtras extends Record<string, unknown> {
  reason: string;
  productId: string;
  productLabel: string;
  /** Text-input backed signed quantity (parsed on submit). */
  quantity: string;
  costPerUnit: string;
  referenceNumber: string;
}

const DEFAULT_EXTRAS: AdjustmentExtras = {
  reason: '',
  productId: '',
  productLabel: '',
  quantity: '',
  costPerUnit: '',
  referenceNumber: '',
};

export function readAdjustmentExtras(values: DocFormValues): AdjustmentExtras {
  return { ...DEFAULT_EXTRAS, ...(values.extras as Partial<AdjustmentExtras>) };
}

/* ─── Seeds ───────────────────────────────────────────────────────── */

export function emptyAdjustmentFormValues(): DocFormValues {
  return {
    ...emptyDocFormValues(),
    partyLabel: null,
    extras: { ...DEFAULT_EXTRAS },
  };
}

/** Adjustment doc → DocForm seed for edit mode (labels resolved). */
export function adjustmentDocToFormValues(
  doc: CrmStockAdjustmentDoc,
  warehouseLabel: string | null,
  productLabel: string | null,
): DocFormValues {
  const extras: AdjustmentExtras = {
    reason: doc.reason ?? '',
    productId: doc.productId ?? '',
    productLabel: productLabel ?? '',
    quantity: doc.quantity !== undefined ? String(doc.quantity) : '',
    costPerUnit:
      doc.costPerUnit !== undefined && doc.costPerUnit !== null
        ? String(doc.costPerUnit)
        : '',
    referenceNumber: doc.referenceNumber ?? '',
  };
  return {
    ...emptyDocFormValues(),
    number: doc.adjustmentNumber ?? '',
    partyId: doc.warehouseId || null,
    partyLabel: warehouseLabel,
    date: (doc.date ?? '').slice(0, 10),
    customerNotes: doc.notes ?? '',
    extras,
  };
}

/* ─── Submit mapping ──────────────────────────────────────────────── */

export function adjustmentFormToInput(
  values: DocFormValues,
):
  | { ok: true; input: SabcrmSupplyStockAdjustmentFullInput }
  | { ok: false; error: string } {
  const extras = readAdjustmentExtras(values);
  if (!values.partyId) {
    return { ok: false, error: 'Pick a warehouse.' };
  }
  if (!extras.reason.trim()) {
    return { ok: false, error: 'A reason is required.' };
  }
  if (!extras.productId) {
    return { ok: false, error: 'Pick a product.' };
  }
  const quantity = Number(extras.quantity);
  if (!Number.isFinite(quantity) || quantity === 0) {
    return {
      ok: false,
      error: 'Quantity must be a non-zero number (negative for stock out).',
    };
  }
  const costPerUnit =
    extras.costPerUnit.trim() === '' ? undefined : Number(extras.costPerUnit);
  if (costPerUnit !== undefined && !Number.isFinite(costPerUnit)) {
    return { ok: false, error: 'Cost per unit is invalid.' };
  }
  return {
    ok: true,
    input: {
      adjustmentNumber: values.number.trim() || undefined,
      date: values.date,
      reason: extras.reason.trim(),
      referenceNumber: extras.referenceNumber.trim() || undefined,
      warehouseId: values.partyId,
      productId: extras.productId,
      quantity,
      costPerUnit,
      notes: values.customerNotes.trim() || undefined,
    },
  };
}

/* ─── DocForm config ──────────────────────────────────────────────── */

/** Builds the adjustment DocForm config (warehouse party + extras). */
export function buildAdjustmentFormConfig(opts: {
  mode: 'create' | 'edit';
}): DocFormConfig {
  return {
    entitySingular: 'Adjustment',
    numberLabel: 'Adjustment #',
    partyLabel: 'Warehouse',
    partyPlaceholder: 'Search warehouses…',
    dateLabel: 'Date',
    dueDateLabel: 'Due date',
    hideDueDate: true,
    hideLines: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    searchParties: async (q) => {
      const res = await searchSabcrmSupplyWarehouses(q);
      return res.ok ? res.data : [];
    },
    suggestNumber:
      opts.mode === 'create'
        ? async () => {
            const res = await suggestNextSupplyNumber('stock-adjustment');
            return res.ok ? res.data : null;
          }
        : undefined,
    extraFields: ({ values, patch, busy }) => {
      const extras = readAdjustmentExtras(values);
      const patchExtras = (p: Partial<AdjustmentExtras>): void =>
        patch({ extras: { ...extras, ...p } });

      return (
        <>
          <div className="fdoc-form-grid__full">
            <Field label="Reason" required>
              <Input
                value={extras.reason}
                onChange={(e) => patchExtras({ reason: e.target.value })}
                placeholder="Cycle count correction"
                disabled={busy}
              />
            </Field>
          </div>

          <Field label="Product" required help="The item being adjusted.">
            <EntityPicker
              value={extras.productId || null}
              valueLabel={extras.productLabel || null}
              search={async (q) => {
                const res = await searchSabcrmSupplyItemOptions(q);
                return res.ok
                  ? res.data.map((i) => ({
                      id: i.id,
                      label: i.label,
                      meta: i.meta,
                    }))
                  : [];
              }}
              placeholder="Search items…"
              disabled={busy}
              onChange={(opt) =>
                patchExtras({
                  productId: opt?.id ?? '',
                  productLabel: opt?.label ?? '',
                })
              }
            />
          </Field>

          <Field
            label="Quantity"
            required
            help="Negative for stock out, positive for stock in."
          >
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={extras.quantity}
              onChange={(e) => patchExtras({ quantity: e.target.value })}
              placeholder="-1"
              disabled={busy}
            />
          </Field>

          <Field label="Cost per unit" help="Used to value the adjustment.">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={extras.costPerUnit}
              onChange={(e) => patchExtras({ costPerUnit: e.target.value })}
              placeholder="0.00"
              disabled={busy}
            />
          </Field>

          <Field label="Reference #" help="External document, if any.">
            <Input
              value={extras.referenceNumber}
              onChange={(e) =>
                patchExtras({ referenceNumber: e.target.value })
              }
              placeholder="GRN-2026-0007"
              disabled={busy}
            />
          </Field>
        </>
      );
    },
  };
}
