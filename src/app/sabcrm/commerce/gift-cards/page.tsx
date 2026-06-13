/**
 * SabCRM Commerce — Gift cards (`/sabcrm/commerce/gift-cards`), 20ui.
 *
 * Server entry for the doc-surface gift-card vertical. Fetches page 1
 * of full-field rows plus the KPI strip in parallel through the gated
 * actions, then hands everything to the kit-driven client. `?q= /
 * ?status=` seed the toolbar; `?edit=<id>` opens the edit drawer
 * client-side. An engine outage normalises into the kit's error state.
 */

import * as React from 'react';

import {
  getSabcrmGiftCardKpis,
  listSabcrmGiftCardsPage,
} from '@/app/actions/sabcrm-commerce-gift-cards.actions';
import type { CrmGiftCardStatus } from '@/lib/rust-client/crm-gift-cards';
import { GiftCardsClient } from './gift-cards-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Gift cards — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceGiftCardsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CrmGiftCardStatus | '';

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmGiftCardsPage({ page: 1, q: q || undefined, status }),
    getSabcrmGiftCardKpis(),
  ]);

  return (
    <GiftCardsClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
    />
  );
}
