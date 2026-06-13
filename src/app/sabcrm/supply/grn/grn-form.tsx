'use client';

/**
 * SabCRM Supply — GRN DocForm wiring (shared by the list client and the
 * detail client so create + edit can never drift; rollout WI-6).
 *
 * DocForm hosts the GRN header (vendor party, receipt date, GRN number)
 * and — via `config.extraFields` — the entity-specific header fields
 * (ship-to warehouse, PO ref, inspector) plus the bespoke
 * {@link GrnLinesEditor}. `hideLines` is on (GRN lines are an
 * ordered/received/accepted/rejected quartet, not rate-bearing), and
 * `hideDueDate` / `hidePaymentTerms` are on (the crate stores neither).
 *
 * The bespoke line drafts live in `values.extras.grnLines` so they
 * round-trip through `onSubmit` untouched, exactly like the PO's
 * ship-to warehouse extra.
 */

import * as React from 'react';

import { Field } from '@/components/sabcrm/20ui';
import {
  EntityPicker,
  type DocFormConfig,
  type DocFormValues,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  searchSabcrmSupplyVendors,
  searchSabcrmSupplyWarehouses,
  searchSabcrmSupplyPurchaseOrders,
  suggestNextSupplyNumber,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { searchSabcrmEmployees } from '@/app/actions/sabcrm-people-employees.actions';
import type { CrmGrnDoc } from '@/lib/rust-client/sabcrm-supply';

import { GrnLinesEditor, blankGrnLine, type GrnLineDraft } from './grn-lines-editor';

/* ─── Extras bag (typed access) ───────────────────────────────── */

export interface GrnFormExtras {
  warehouseId: string;
  warehouseLabel: string;
  poId: string;
  poLabel: string;
  inspectorId: string;
  inspectorLabel: string;
  grnLines: GrnLineDraft[];
}

export function readGrnExtras(values: DocFormValues): GrnFormExtras {
  const e = (values.extras ?? {}) as Record<string, unknown>;
  return {
    warehouseId: typeof e.warehouseId === 'string' ? e.warehouseId : '',
    warehouseLabel:
      typeof e.warehouseLabel === 'string' ? e.warehouseLabel : '',
    poId: typeof e.poId === 'string' ? e.poId : '',
    poLabel: typeof e.poLabel === 'string' ? e.poLabel : '',
    inspectorId: typeof e.inspectorId === 'string' ? e.inspectorId : '',
    inspectorLabel:
      typeof e.inspectorLabel === 'string' ? e.inspectorLabel : '',
    grnLines: Array.isArray(e.grnLines)
      ? (e.grnLines as GrnLineDraft[])
      : [blankGrnLine()],
  };
}

/* ─── Form config ─────────────────────────────────────────────── */

export function buildGrnFormConfig(): DocFormConfig {
  return {
    entitySingular: 'Goods receipt',
    numberLabel: 'GRN number',
    partyLabel: 'Vendor',
    partyPlaceholder: 'Search vendors…',
    dateLabel: 'Receipt date',
    dueDateLabel: 'Receipt date',
    hideDueDate: true,
    hideLines: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    searchParties: async (q) => {
      const res = await searchSabcrmSupplyVendors(q);
      return res.ok ? res.data : [];
    },
    suggestNumber: async () => {
      const res = await suggestNextSupplyNumber('grn');
      return res.ok ? res.data : null;
    },
    extraFields: ({ values, patch, busy }) => {
      const extras = readGrnExtras(values);
      const setExtra = (p: Partial<GrnFormExtras>): void =>
        patch({ extras: { ...(values.extras ?? {}), ...p } });
      return (
        <>
          <Field label="Receiving warehouse" required>
            <EntityPicker
              value={extras.warehouseId || null}
              valueLabel={extras.warehouseLabel || null}
              search={async (q) => {
                const res = await searchSabcrmSupplyWarehouses(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search warehouses…"
              disabled={busy}
              onChange={(opt) =>
                setExtra({
                  warehouseId: opt?.id ?? '',
                  warehouseLabel: opt?.label ?? '',
                })
              }
            />
          </Field>

          <Field label="Purchase order" help="Optional — for received POs.">
            <EntityPicker
              value={extras.poId || null}
              valueLabel={extras.poLabel || null}
              search={async (q) => {
                const res = await searchSabcrmSupplyPurchaseOrders(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search purchase orders…"
              disabled={busy}
              onChange={(opt) =>
                setExtra({ poId: opt?.id ?? '', poLabel: opt?.label ?? '' })
              }
            />
          </Field>

          <Field label="Inspector" help="Optional — who checked the goods.">
            <EntityPicker
              value={extras.inspectorId || null}
              valueLabel={extras.inspectorLabel || null}
              search={async (q) => {
                const res = await searchSabcrmEmployees(q);
                return res.ok ? res.data : [];
              }}
              placeholder="Search employees…"
              disabled={busy}
              onChange={(opt) =>
                setExtra({
                  inspectorId: opt?.id ?? '',
                  inspectorLabel: opt?.label ?? '',
                })
              }
            />
          </Field>

          <div className="fdoc-form-grid__full">
            <Field label="Received lines" required>
              <GrnLinesEditor
                lines={extras.grnLines}
                onChange={(grnLines) => setExtra({ grnLines })}
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

export function grnToFormValues(
  doc: CrmGrnDoc,
  opts: {
    vendorLabel: string | null;
    warehouseLabel: string | null;
    poLabel: string | null;
    inspectorLabel: string | null;
    itemLabels: Map<string, string>;
  },
): DocFormValues {
  const grnLines: GrnLineDraft[] = (doc.items ?? []).map((it, i) => ({
    rowId: `seed-${i}`,
    itemId: it.itemId,
    itemLabel: it.itemId ? (opts.itemLabels.get(it.itemId) ?? null) : null,
    orderedQty: it.orderedQty,
    receivedQty: it.receivedQty,
    acceptedQty: it.acceptedQty,
    rejectedQty: it.rejectedQty,
    batch: it.batch ?? '',
    expiry: (it.expiry ?? '').slice(0, 10),
    serialNos: it.serialNos ?? [],
  }));
  return {
    number: doc.grnNo,
    partyId: doc.vendorId || null,
    partyLabel: opts.vendorLabel,
    currency: 'INR',
    date: (doc.date ?? '').slice(0, 10),
    dueDate: (doc.date ?? '').slice(0, 10),
    lines: [],
    paymentTerms: '',
    customerNotes: '',
    termsAndConditions: '',
    attachments: (doc.attachments ?? []).map((a) => ({
      fileId: a.url,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
    })),
    extras: {
      warehouseId: doc.warehouseId ?? '',
      warehouseLabel: opts.warehouseLabel ?? '',
      poId: doc.poId ?? '',
      poLabel: opts.poLabel ?? '',
      inspectorId: doc.inspectorId ?? '',
      inspectorLabel: opts.inspectorLabel ?? '',
      grnLines: grnLines.length > 0 ? grnLines : [blankGrnLine()],
    },
  };
}
