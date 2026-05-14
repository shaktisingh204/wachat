'use client';

/**
 * <DealRelatedRail> — right-rail "Related" card with live counts.
 *
 * Hydrates from an initial server-rendered snapshot and refreshes from
 * `getCrmDealRelatedCounts` so the chip numbers stay current as
 * Quotations / Invoices / Tasks / Tickets get linked from elsewhere in
 * the session.
 */

import * as React from 'react';
import Link from 'next/link';
import { FileText, ListChecks, Receipt, Ticket, User2 } from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';
import { getCrmDealRelatedCounts } from '@/app/actions/crm-deals.actions';

interface RelatedCounts {
  quotations: number;
  invoices: number;
  tasks: number;
  tickets: number;
  contacts: number;
}

interface DealRelatedRailProps {
  dealId: string;
  accountId?: string | null;
  initial: RelatedCounts;
}

export function DealRelatedRail({ dealId, accountId, initial }: DealRelatedRailProps) {
  const [counts, setCounts] = React.useState<RelatedCounts>(initial);

  // Re-fetch on mount in case the user just linked an entity from
  // another tab — initial snapshot may be stale.
  React.useEffect(() => {
    let cancelled = false;
    getCrmDealRelatedCounts(dealId).then((next) => {
      if (!cancelled) setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  return (
    <ZoruCard className="p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Related
      </h3>
      <ul className="space-y-1.5 text-[12.5px]">
        <RelatedLink
          href={`/dashboard/crm/sales/quotations?dealId=${dealId}`}
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Quotations"
          count={counts.quotations}
        />
        <RelatedLink
          href={`/dashboard/crm/sales/invoices?dealId=${dealId}`}
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Invoices"
          count={counts.invoices}
        />
        <RelatedLink
          href={`/dashboard/crm/sales-crm/tasks?dealId=${dealId}`}
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label="Tasks"
          count={counts.tasks}
        />
        <RelatedLink
          href={`/dashboard/crm/tickets?dealId=${dealId}`}
          icon={<Ticket className="h-3.5 w-3.5" />}
          label="Tickets"
          count={counts.tickets}
        />
        {accountId ? (
          <RelatedLink
            href={`/dashboard/crm/accounts/${accountId}`}
            icon={<User2 className="h-3.5 w-3.5" />}
            label="Account contacts"
            count={counts.contacts}
          />
        ) : null}
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
        <span className="font-mono tabular-nums text-zoru-ink-muted">{count}</span>
      </Link>
    </li>
  );
}
