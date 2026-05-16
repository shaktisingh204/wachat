'use client';

/**
 * <PurchaseOrderRelatedRail> — thin wrapper over <EntityRelatedRail> (P5.6).
 */

import * as React from 'react';
import {
  FileMinus,
  FileText,
  Gavel,
  MessageSquareQuote,
  PackageCheck,
  Wallet,
} from 'lucide-react';

import { EntityRelatedRail } from '@/components/crm/entity-related-rail';
import { getCrmPurchaseOrderRelatedCounts } from '@/app/actions/crm/purchase-orders.actions';

type RelatedKey =
  | 'grns'
  | 'bills'
  | 'debitNotes'
  | 'payouts'
  | 'rfqs'
  | 'vendorBids';

interface PurchaseOrderRelatedRailProps {
  poId: string;
  initial: Record<RelatedKey, number>;
}

export function PurchaseOrderRelatedRail({
  poId,
  initial,
}: PurchaseOrderRelatedRailProps) {
  return (
    <EntityRelatedRail<RelatedKey>
      initial={initial}
      refresh={() => getCrmPurchaseOrderRelatedCounts(poId)}
      items={[
        {
          key: 'grns',
          label: 'GRNs',
          icon: <PackageCheck className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/inventory/grn?purchaseOrderId=${poId}`,
        },
        {
          key: 'bills',
          label: 'Bills',
          icon: <FileText className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/bills?purchaseOrderId=${poId}`,
        },
        {
          key: 'debitNotes',
          label: 'Debit notes',
          icon: <FileMinus className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/debit-notes?purchaseOrderId=${poId}`,
        },
        {
          key: 'payouts',
          label: 'Payouts',
          icon: <Wallet className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/payouts?purchaseOrderId=${poId}`,
        },
        {
          key: 'rfqs',
          label: 'RFQs',
          icon: <MessageSquareQuote className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/rfqs?purchaseOrderId=${poId}`,
        },
        {
          key: 'vendorBids',
          label: 'Vendor bids',
          icon: <Gavel className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/vendor-bids?purchaseOrderId=${poId}`,
        },
      ]}
    />
  );
}
