/**
 * CRM Employees list — `/dashboard/crm/hr-payroll/employees`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listEmployees` action, and hands off to
 * `<EmployeeListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Users, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listEmployees } from '@/app/actions/crm/employees.actions';
import { EmployeeListClient } from './_components/employee-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { employees, hasMore, error } = await listEmployees({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employees"
        subtitle="Manage your people — identity, organisation, employment, and personal details."
        icon={Users}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/hr-payroll/employees/new">
              <Plus className="h-4 w-4" />
              New employee
            </Link>
          </ZoruButton>
        }
      />

      <EmployeeListClient
        employees={employees}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
