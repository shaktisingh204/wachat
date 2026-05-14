'use client';

/**
 * <BillRelatedRail> — right-rail "Related" card with live counts of
 * payouts applied, debit notes issued, and upstream PO/GRN docs.
 */

import * as React from 'react';
import Link from 'next/link';
import { FileMinus, FileText, Receipt, Truck } from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';
import { getCrmBillRelatedCounts } from '@/app/actions/crm/bills.actions';

interface RelatedCounts {
  payouts: number;
  debitNotes: number;
  purchaseOrders: number;
  grns: number;
}

interface BillRelatedRailProps {
  billId: string;
  initial: RelatedCounts;
}

export function BillRelatedRail({ billId, initial }: BillRelatedRailProps) {
  const [counts, setCounts] = React.useState<RelatedCounts>(initial);

  React.useEffect(() => {
    let cancelled = false;
    getCrmBillRelatedCounts(billId).then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [billId]);

  return (
    <ZoruCard className="p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Related
      </h3>
      <ul className="space-y-1.5 text-[12.5px]">
        <RelatedLink
          href={`/dashboard/crm/purchases/payouts?billId=${billId}`}
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Payouts"
          count={counts.payouts}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/debit-notes?billId=${billId}`}
          icon={<FileMinus className="h-3.5 w-3.5" />}
          label="Debit notes"
          count={counts.debitNotes}
        />
        <RelatedLink
          href={`/dashboard/crm/purchases/orders?billId=${billId}`}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Purchase orders"
          count={counts.purchaseOrders}
        />
        <RelatedLink
          href={`/dashboard/crm/inventory/grn?billId=${billId}`}
          icon={<Truck className="h-3.5 w-3.5" />}
          label="GRNs"
          count={counts.grns}
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
