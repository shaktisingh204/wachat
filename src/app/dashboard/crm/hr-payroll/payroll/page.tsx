/**
 * Payroll Runs list — `/dashboard/crm/hr-payroll/payroll`.
 *
 * Server component shell. Reads search/page/limit/status from the URL,
 * fetches via the Rust-backed `listPayrollRuns` action, and hands off to
 * `<PayrollRunListClient>` for interactive bits (filter, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Banknote, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listPayrollRuns } from '@/app/actions/crm/payroll-runs.actions';
import { PayrollRunListClient } from './_components/payroll-run-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  status?: string;
}

export default async function PayrollRunsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const status = (sp.status ?? '').trim();

  const { runs, hasMore, error } = await listPayrollRuns({
    page,
    limit,
    status: status || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Payroll Runs"
        subtitle="Compute, approve, and disburse per-period salary runs."
        icon={Banknote}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/hr-payroll/payroll/new">
              <Plus className="h-4 w-4" />
              New payroll run
            </Link>
          </ZoruButton>
        }
      />

      <PayrollRunListClient
        runs={runs}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialStatus={status}
        error={error}
      />
    </div>
  );
}
