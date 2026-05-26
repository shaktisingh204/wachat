'use client';

/**
 * <DealRelatedRail> — thin wrapper over <EntityRelatedRail> (P5.6).
 *
 * `accountId` is optional — when present, the "Account contacts" row
 * is added; otherwise it's hidden via `hideWhenZero`.
 */

import * as React from 'react';
import { FileText, ListChecks, Receipt, Ticket, User2 } from 'lucide-react';

import { EntityRelatedRail, type EntityRelatedRailItem } from '@/components/crm/entity-related-rail';
import { getCrmDealRelatedCounts } from '@/app/actions/crm-deals.actions';

type RelatedKey = 'quotations' | 'invoices' | 'tasks' | 'tickets' | 'contacts';

interface DealRelatedRailProps {
  dealId: string;
  accountId?: string | null;
  initial: Record<RelatedKey, number>;
}

export function DealRelatedRail({ dealId, accountId, initial }: DealRelatedRailProps) {
  const items: EntityRelatedRailItem<RelatedKey>[] = [
    {
      key: 'quotations',
      label: 'Quotations',
      icon: <FileText className="h-3.5 w-3.5" />,
      href: `/dashboard/crm/sales/quotations?dealId=${dealId}`,
    },
    {
      key: 'invoices',
      label: 'Invoices',
      icon: <Receipt className="h-3.5 w-3.5" />,
      href: `/dashboard/crm/sales/invoices?dealId=${dealId}`,
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: <ListChecks className="h-3.5 w-3.5" />,
      href: `/dashboard/crm/sales-crm/tasks?dealId=${dealId}`,
    },
    {
      key: 'tickets',
      label: 'Tickets',
      icon: <Ticket className="h-3.5 w-3.5" />,
      href: `/dashboard/sabdesk?dealId=${dealId}`,
    },
  ];
  if (accountId) {
    items.push({
      key: 'contacts',
      label: 'Account contacts',
      icon: <User2 className="h-3.5 w-3.5" />,
      href: `/dashboard/crm/accounts/${accountId}`,
    });
  }

  return (
    <EntityRelatedRail<RelatedKey>
      initial={initial}
      refresh={() => getCrmDealRelatedCounts(dealId)}
      items={items}
    />
  );
}
