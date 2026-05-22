import { Button } from '@/components/zoruui';
import { Plus } from 'lucide-react';

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

import { getT } from '@/lib/i18n/server';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listLeads } from '@/app/actions/crm/leads.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { LeadListClient } from './_components/lead-list-client';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

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

  const [t, { leads, hasMore, error }, customFields] = await Promise.all([
    getT(),
    listLeads({ page, limit, q: q || undefined }),
    getCustomFieldsFor('lead').catch(() => []) as Promise<WsCustomField[]>,
  ]);

  return (
    <EntityListShell
      title={t('crm.leads.list.title')}
      subtitle={t('crm.leads.list.subtitle')}
    >
      <LeadListClient
        leads={leads}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
        customFields={customFields}
      />
    </EntityListShell>
  );
}
