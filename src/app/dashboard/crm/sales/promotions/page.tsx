import { ZoruButton } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM Promotions list — `/dashboard/crm/sales/promotions`.
 *
 * §1D deep-list shell. Server component reads search/status/type/date
 * params from the URL, fetches the canonical Mongo-backed promotions
 * via `getPromotions`, fetches KPIs via `getPromotionKpis`, and hands
 * off to `<PromotionListClient>` for KPI strip, filter row, bulk-bar,
 * CSV/XLSX export.
 *
 * Pagination is hasMore-driven over a window slice (the Mongo action
 * uses `limit`, not skip/limit pages, so we ask for `page * limit + 1`
 * and slice — same pattern as the delivery list).
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getPromotionKpis,
  getPromotions,
  type CrmPromotionDoc,
  type CrmPromotionStatus,
  type CrmPromotionType,
} from '@/app/actions/crm-promotions.actions';

import { PromotionListClient } from './_components/promotion-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const type = (sp.type ?? '').trim();
  const dateFrom = (sp.dateFrom ?? '').trim();
  const dateTo = (sp.dateTo ?? '').trim();

  // Load a wide window so we can slice for pagination, then apply
  // client-side date filters that the action doesn't yet expose.
  const wideLimit = Math.max(200, page * limit + 1);
  const [listResult, kpis] = await Promise.all([
    getPromotions({
      q: q || undefined,
      status: (status || 'all') as CrmPromotionStatus | 'all',
      type: (type || 'all') as CrmPromotionType | 'all',
      limit: wideLimit,
    }),
    getPromotionKpis(),
  ]);

  const all: CrmPromotionDoc[] = listResult.items.filter((row) => {
    if (dateFrom) {
      const t = row.validFrom ? new Date(row.validFrom).getTime() : NaN;
      const cutoff = new Date(dateFrom).getTime();
      if (Number.isFinite(t) && Number.isFinite(cutoff) && t < cutoff) return false;
    }
    if (dateTo) {
      const t = row.validTo ? new Date(row.validTo).getTime() : NaN;
      const cutoff = new Date(`${dateTo}T23:59:59`).getTime();
      if (Number.isFinite(t) && Number.isFinite(cutoff) && t > cutoff) return false;
    }
    return true;
  });

  const skip = (page - 1) * limit;
  const pageSlice = all.slice(skip, skip + limit);
  const hasMore = all.length > skip + limit;

  return (
    <EntityListShell
      title="Promotions"
      subtitle="Manage discount codes, scheduled offers, and redemption windows."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/sales/promotions/new">
            <Plus className="h-4 w-4" />
            New promotion
          </Link>
        </ZoruButton>
      }
    >
      <PromotionListClient
        promotions={pageSlice}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        initialStatus={status}
        initialType={type}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        kpis={kpis}
        error={listResult.error}
      />
    </EntityListShell>
  );
}
