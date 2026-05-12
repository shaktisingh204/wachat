/**
 * CRM Leave Requests list — `/dashboard/crm/hr-payroll/leave`.
 *
 * Server component shell. Reads page/limit from the URL, fetches via
 * the Rust-backed `listLeaves` action, and hands off to
 * `<LeaveListClient>` for interactive bits (delete dialog). The Rust
 * applications endpoint doesn't expose a free-text search yet, so the
 * search box surfaced on the lead list is omitted here.
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listLeaves, listLeaveTypeOptions } from '@/app/actions/crm/leaves.actions';
import { LeaveListClient } from './_components/leave-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);

  const [{ leaves, hasMore, error }, { options: leaveTypes }] = await Promise.all([
    listLeaves({ page, limit }),
    listLeaveTypeOptions(),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Requests"
        subtitle="Submit, review, and approve employee leave applications."
        icon={CalendarDays}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/hr-payroll/leave/new">
              <Plus className="h-4 w-4" />
              New leave request
            </Link>
          </ZoruButton>
        }
      />

      <LeaveListClient
        leaves={leaves}
        leaveTypes={leaveTypes}
        page={page}
        limit={limit}
        hasMore={hasMore}
        error={error}
      />
    </div>
  );
}
