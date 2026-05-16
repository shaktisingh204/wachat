'use client';

/**
 * <InvoiceRelatedRail> — thin wrapper over the shared
 * `<EntityRelatedRail>` (see CRM_REBUILD_PLAN §5.6). The wrapper exists
 * so the page-level prop shape stays stable while the rendering /
 * refresh logic lives in one place.
 */

import * as React from 'react';
import {
  FileCheck,
  FileMinus,
  FileText,
  ShoppingCart,
  Truck,
} from 'lucide-react';

import { EntityRelatedRail } from '@/components/crm/entity-related-rail';
import { getCrmInvoiceRelatedCounts } from '@/app/actions/crm/invoices.actions';

type RelatedKey =
  | 'receipts'
  | 'creditNotes'
  | 'quotations'
  | 'salesOrders'
  | 'deliveries';

interface InvoiceRelatedRailProps {
  invoiceId: string;
  initial: Record<RelatedKey, number>;
}

export function InvoiceRelatedRail({ invoiceId, initial }: InvoiceRelatedRailProps) {
  return (
    <EntityRelatedRail<RelatedKey>
      initial={initial}
      refresh={() => getCrmInvoiceRelatedCounts(invoiceId)}
      items={[
        {
          key: 'receipts',
          label: 'Payment receipts',
          icon: <FileCheck className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/sales/receipts?invoiceId=${invoiceId}`,
        },
        {
          key: 'creditNotes',
          label: 'Credit notes',
          icon: <FileMinus className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/sales/credit-notes?invoiceId=${invoiceId}`,
        },
        {
          key: 'quotations',
          label: 'Quotations',
          icon: <FileText className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/sales/quotations?invoiceId=${invoiceId}`,
        },
        {
          key: 'salesOrders',
          label: 'Sales orders',
          icon: <ShoppingCart className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/sales/orders?invoiceId=${invoiceId}`,
        },
        {
          key: 'deliveries',
          label: 'Delivery challans',
          icon: <Truck className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/sales/delivery?invoiceId=${invoiceId}`,
        },
      ]}
    />
  );
}
