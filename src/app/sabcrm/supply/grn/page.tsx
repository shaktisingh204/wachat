/**
 * SabCRM Supply — Goods receipts (`/sabcrm/supply/grn`, rollout WI-6).
 *
 * Server entry: page 1 of display-ready rows (vendor / warehouse / PO
 * labels resolved server-side) + the KPI strip, in parallel through the
 * gated actions. `?fromPo=<id>` (the PO detail's "Receive → GRN"
 * convert) is resolved into a prefilled DocForm seed so receiving stays a
 * reviewed form, not a blind copy.
 */

import * as React from 'react';

import {
  getSabcrmSupplyGrnKpis,
  getSabcrmSupplyGrnPrefillFromPo,
  listSabcrmSupplyGrnsPage,
} from '@/app/actions/sabcrm-supply-grn.actions';
import { suggestNextSupplyNumber } from '@/app/actions/sabcrm-supply-docs.actions';
import type { SabcrmGrnStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { DocFormValues } from '@/app/sabcrm/finance/_components/doc-surface';
import { GrnClient } from './grn-client';
import { blankGrnLine } from './grn-lines-editor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Goods receipts — SabCRM Supply',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function SabcrmSupplyGrnPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as SabcrmGrnStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);
  const fromPo = first(params.fromPo);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmSupplyGrnsPage({
      page: 1,
      q: q || undefined,
      status,
      vendorId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmSupplyGrnKpis(),
  ]);

  let prefillValues: DocFormValues | null = null;
  if (fromPo) {
    const [prefillRes, numberRes] = await Promise.all([
      getSabcrmSupplyGrnPrefillFromPo(fromPo),
      suggestNextSupplyNumber('grn'),
    ]);
    if (prefillRes.ok) {
      const p = prefillRes.data;
      const grnLines =
        p.lines.length > 0
          ? p.lines.map((l, i) => ({
              rowId: `po-${i}`,
              itemId: l.itemId,
              itemLabel: l.itemLabel,
              orderedQty: l.orderedQty,
              receivedQty: l.orderedQty,
              acceptedQty: l.orderedQty,
              rejectedQty: 0,
              batch: '',
              expiry: '',
              serialNos: [] as string[],
            }))
          : [blankGrnLine()];
      prefillValues = {
        number: numberRes.ok ? numberRes.data : '',
        partyId: p.vendorId || null,
        partyLabel: p.vendorLabel,
        currency: 'INR',
        date: todayKey(),
        dueDate: todayKey(),
        lines: [],
        paymentTerms: '',
        customerNotes: '',
        termsAndConditions: '',
        attachments: [],
        extras: {
          warehouseId: p.warehouseId ?? '',
          warehouseLabel: p.warehouseLabel ?? '',
          poId: p.poId,
          poLabel: p.poLabel,
          inspectorId: '',
          inspectorLabel: '',
          grnLines,
        },
      };
    }
  }

  return (
    <GrnClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
      prefillValues={prefillValues}
    />
  );
}
