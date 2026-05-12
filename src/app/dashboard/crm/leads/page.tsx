/**
 * CRM Leads list — `/dashboard/crm/leads`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listLeads` action, and hands off to
 * `<LeadListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Users, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';
import { listLeads } from '@/app/actions/crm/leads.actions';
import { LeadListClient } from './_components/lead-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { leads, hasMore, error } = await listLeads({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leads"
        subtitle="Capture, qualify, and route prospects through your sales pipeline."
        icon={Users}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/leads/new">
              <Plus className="h-4 w-4" />
              New lead
            </Link>
          </ZoruButton>
        }
      />

      <LeadListClient
        leads={leads}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
