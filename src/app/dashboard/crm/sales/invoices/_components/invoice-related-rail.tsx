'use client';

/**
 * <InvoiceRelatedRail> — right-rail "Related" card with live counts.
 *
 * Hydrates from a server-rendered snapshot, then refreshes from
 * `getCrmInvoiceRelatedCounts` so chips reflect the latest state if the
 * user links a doc from another tab.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  FileCheck,
  FileMinus,
  FileText,
  ShoppingCart,
  Truck,
} from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';
import { getCrmInvoiceRelatedCounts } from '@/app/actions/crm/invoices.actions';

interface RelatedCounts {
  receipts: number;
  creditNotes: number;
  quotations: number;
  salesOrders: number;
  deliveries: number;
}

interface InvoiceRelatedRailProps {
  invoiceId: string;
  initial: RelatedCounts;
}

export function InvoiceRelatedRail({ invoiceId, initial }: InvoiceRelatedRailProps) {
  const [counts, setCounts] = React.useState<RelatedCounts>(initial);

  React.useEffect(() => {
    let cancelled = false;
    getCrmInvoiceRelatedCounts(invoiceId).then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  return (
    <ZoruCard className="p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Related
      </h3>
      <ul className="space-y-1.5 text-[12.5px]">
        <RelatedLink
          href={`/dashboard/crm/sales/receipts?invoiceId=${invoiceId}`}
          icon={<FileCheck className="h-3.5 w-3.5" />}
          label="Payment receipts"
          count={counts.receipts}
        />
        <RelatedLink
          href={`/dashboard/crm/sales/credit-notes?invoiceId=${invoiceId}`}
          icon={<FileMinus className="h-3.5 w-3.5" />}
          label="Credit notes"
          count={counts.creditNotes}
        />
        <RelatedLink
          href={`/dashboard/crm/sales/quotations?invoiceId=${invoiceId}`}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Quotations"
          count={counts.quotations}
        />
        <RelatedLink
          href={`/dashboard/crm/sales/orders?invoiceId=${invoiceId}`}
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label="Sales orders"
          count={counts.salesOrders}
        />
        <RelatedLink
          href={`/dashboard/crm/sales/delivery?invoiceId=${invoiceId}`}
          icon={<Truck className="h-3.5 w-3.5" />}
          label="Delivery challans"
          count={counts.deliveries}
        />
      </ul>
    </ZoruCard>
  );
}

function RelatedLink({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-zoru-ink hover:bg-zoru-surface-2"
      >
        <span className="inline-flex items-center gap-1.5 text-zoru-ink">
          <span className="text-zoru-ink-muted">{icon}</span>
          {label}
        </span>
        <span className="font-mono tabular-nums text-zoru-ink-muted">
          {count}
        </span>
      </Link>
    </li>
  );
}
