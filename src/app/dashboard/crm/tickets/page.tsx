/**
 * CRM Tickets list — `/dashboard/crm/tickets`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listTickets` action, and hands off to
 * `<TicketListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { LifeBuoy, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';
import { listTickets } from '@/app/actions/crm/tickets.actions';
import { TicketListClient } from './_components/ticket-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { tickets, hasMore, error } = await listTickets({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Tickets"
        subtitle="Track customer issues, route them to the right agent, and resolve them on SLA."
        icon={LifeBuoy}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/tickets/new">
              <Plus className="h-4 w-4" />
              New ticket
            </Link>
          </ZoruButton>
        }
      />

      <TicketListClient
        tickets={tickets}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
