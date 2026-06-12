/**
 * SabCRM Commerce — POS refunds (`/sabcrm/commerce/pos-refunds`), 20ui.
 *
 * Server entry: lists the active project's register refunds through the
 * gated `listSabcrmPosRefunds` action (crate `crm-pos`,
 * `/v1/sabcrm/commerce/pos/refunds`). Read-heavy — refunds are issued
 * against transactions; this surface is the audit list.
 */

import * as React from 'react';

import { listSabcrmPosRefunds } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS refunds — SabCRM Commerce',
};

export default async function SabcrmCommercePosRefundsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPosRefunds({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.reason || `refund from ${doc.processedAt.slice(0, 10)}`,
    status: doc.status,
    currency: 'INR',
    cells: {
      processedAt: doc.processedAt,
      reason: doc.reason,
      refundMethod: doc.refundMethod,
      refundTotal: doc.refundTotal,
    },
  }));

  return (
    <CommerceClient
      kind="pos-refunds"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
