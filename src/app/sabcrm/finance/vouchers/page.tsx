/**
 * SabCRM Finance — Voucher books (`/sabcrm/finance/vouchers`).
 *
 * Server entry for the doc-surface-kit adopter (spec §3.13). Fetches
 * page 1 of display-ready rows plus the KPI strip in parallel through
 * the gated actions, then hands everything to the kit-driven client
 * (full-field dialog form, type filter, bulk archive/restore, CSV).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 * The Rust engine may be down at dev time — that normalises into an
 * inline error state instead of crashing the route.
 */

import * as React from 'react';

import {
  getSabcrmVoucherBookKpis,
  listSabcrmVoucherBooksPage,
} from '@/app/actions/sabcrm-finance-vouchers.actions';
import { VouchersClient } from './vouchers-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Voucher books — SabCRM Finance',
};

export default async function SabcrmFinanceVouchersPage(): Promise<React.JSX.Element> {
  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmVoucherBooksPage({ page: 1 }),
    getSabcrmVoucherBookKpis(),
  ]);

  return (
    <VouchersClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
