import Link from 'next/link';
import { Building2, Plus, Network } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listDepartments } from '@/app/actions/crm/departments.actions';
import { DepartmentListClient } from './_components/department-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { items, hasMore, error } = await listDepartments({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Departments"
        subtitle="Organizational units."
        icon={Building2}
        actions={
          <>
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/hr-payroll/departments/hierarchy">
                <Network className="h-4 w-4" /> Hierarchy
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/hr-payroll/departments/new">
                <Plus className="h-4 w-4" /> New department
              </Link>
            </ZoruButton>
          </>
        }
      />
      <DepartmentListClient
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
