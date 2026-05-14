'use client';

/**
 * <PurchaseOrderRelatedRail> — right-rail "Related" card with live
 * counts.
 *
 * Hydrates from a server-rendered snapshot, then refreshes from
 * `getCrmPurchaseOrderRelatedCounts` so chips reflect the latest state
 * if the user links a doc from another tab.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  FileMinus,
  FileText,
  Gavel,
  MessageSquareQuote,
  PackageCheck,
  Wallet,
} from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';
import { getCrmPurchaseOrderRelatedCounts } from '@/app/actions/crm/purchase-orders.actions';

interface RelatedCounts {
  grns: number;
  bills: number;
  debitNotes: number;
  payouts: number;
  rfqs: number;
  vendorBids: number;
}

interface PurchaseOrderRelatedRailProps {
  poId: string;
  initial: RelatedCounts;
}

export function PurchaseOrderRelatedRail({
  poId,
  initial,
}: PurchaseOrderRelatedRailProps) {
  const [counts, setCounts] = React.useState<RelatedCounts>(initial);

  React.useEffect(() => {
    let cancelled = false;
    getCrmPurchaseOrderRelatedCounts(poId).then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [poId]);

  return (
    <ZoruCard className="p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Related
      </h3>
      <ul className="space-y-1.5 text-[12.5px]">
        <RelatedLink
          href={`/dashboard/crm/inventory/grn?purchaseOrderId=${poId}`}
          icon={<PackageCheck className="h-3.5 w-3.5" />}
          label="GRNs"
          count={counts.grns}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/bills?purchaseOrderId=${poId}`}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Bills"
          count={counts.bills}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/debit-notes?purchaseOrderId=${poId}`}
          icon={<FileMinus className="h-3.5 w-3.5" />}
          label="Debit notes"
          count={counts.debitNotes}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/payouts?purchaseOrderId=${poId}`}
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Payouts"
          count={counts.payouts}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/rfqs?purchaseOrderId=${poId}`}
          icon={<MessageSquareQuote className="h-3.5 w-3.5" />}
          label="RFQs"
          count={counts.rfqs}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/vendor-bids?purchaseOrderId=${poId}`}
          icon={<Gavel className="h-3.5 w-3.5" />}
          label="Vendor bids"
          count={counts.vendorBids}
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
