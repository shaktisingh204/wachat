'use client';

/**
 * <BillRelatedRail> — thin wrapper over <EntityRelatedRail> (P5.6).
 */

import * as React from 'react';
import { FileMinus, FileText, Receipt, Truck } from 'lucide-react';

import { EntityRelatedRail } from '@/components/crm/entity-related-rail';
import { getCrmBillRelatedCounts } from '@/app/actions/crm/bills.actions';

type RelatedKey = 'payouts' | 'debitNotes' | 'purchaseOrders' | 'grns';

interface BillRelatedRailProps {
  billId: string;
  initial: Record<RelatedKey, number>;
}

export function BillRelatedRail({ billId, initial }: BillRelatedRailProps) {
  return (
    <EntityRelatedRail<RelatedKey>
      initial={initial}
      refresh={() => getCrmBillRelatedCounts(billId)}
      items={[
        {
          key: 'payouts',
          label: 'Payouts',
          icon: <Receipt className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/payouts?billId=${billId}`,
        },
        {
          key: 'debitNotes',
          label: 'Debit notes',
          icon: <FileMinus className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/debit-notes?billId=${billId}`,
        },
        {
          key: 'purchaseOrders',
          label: 'Purchase orders',
          icon: <FileText className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/purchases/orders?billId=${billId}`,
        },
        {
          key: 'grns',
          label: 'GRNs',
          icon: <Truck className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/inventory/grn?billId=${billId}`,
        },
      ]}
    />
  );
}
