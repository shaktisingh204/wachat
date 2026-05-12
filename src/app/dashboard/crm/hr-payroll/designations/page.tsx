import Link from 'next/link';
import { BadgeCheck, Plus, Network } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listDesignations } from '@/app/actions/crm/departments.actions';
import { DesignationListClient } from './_components/designation-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function DesignationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { items, hasMore, error } = await listDesignations({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Designations"
        subtitle="Roles within your organization."
        icon={BadgeCheck}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/designations/hierarchy">
                <Network className="h-4 w-4" /> Hierarchy
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/hr-payroll/designations/new">
                <Plus className="h-4 w-4" /> New designation
              </Link>
            </ZoruButton>
          </>
        }
      />
      <DesignationListClient
        items={items}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
