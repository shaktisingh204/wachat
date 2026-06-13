/**
 * SabCRM Supply — BOM detail (`/sabcrm/supply/bom/[id]`, rollout WI-10).
 *
 * Server entry: fetches the BOM, then hands it to the detail client.
 */

import * as React from 'react';

import { getSabcrmSupplyBom } from '@/app/actions/sabcrm-supply-docs.actions';
import { BomDetailClient } from './bom-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bill of materials — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyBomDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getSabcrmSupplyBom(id);
  return (
    <BomDetailClient
      bom={res.ok ? res.data : null}
      error={res.ok ? null : res.error}
    />
  );
}
