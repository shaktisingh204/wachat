'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, Building, Edit } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { CrmAddAccountDialog } from '@/components/wabasimplify/crm-add-account-dialog';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

const ACCOUNTS_PER_PAGE = 20;

function AccountsPageSkeleton() {
  return (
    <ClayCard>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="mt-4 h-96 w-full" />
    </ClayCard>
  );
}

export default function CrmAccountsPage() {
  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const { accounts: data, total } = await getCrmAccounts(
        currentPage,
        ACCOUNTS_PER_PAGE,
        searchQuery,
      );
      setAccounts(data);
      setTotalPages(Math.ceil(total / ACCOUNTS_PER_PAGE));
    });
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  if (isLoading && accounts.length === 0) return <AccountsPageSkeleton />;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Accounts (Companies)"
        subtitle="Manage your company-level records."
        icon={Building}
        actions={<CrmAddAccountDialog onAdded={fetchData} />}
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">All Accounts</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              A list of all companies in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
            <Input
              placeholder="Search by name, industry, or website..."
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Account Name</TableHead>
                <TableHead className="text-clay-ink-muted">Industry</TableHead>
                <TableHead className="text-clay-ink-muted">Website</TableHead>
                <TableHead className="text-clay-ink-muted">Created</TableHead>
                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={5}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : accounts.length > 0 ? (
                accounts.map((account) => (
                  <TableRow key={account._id.toString()} className="border-clay-border">
                    <TableCell>
                      <Link
                        href={`/dashboard/crm/accounts/${account._id.toString()}`}
                        className="flex items-center gap-2 text-[13px] font-medium text-clay-ink hover:underline"
                      >
                        <Building className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
                        {account.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {account.industry || 'N/A'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {account.website || 'N/A'}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {formatDistanceToNow(new Date(account.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/crm/accounts/${account._id.toString()}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-clay-md text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink"
                        aria-label="Edit account"
                      >
                        <Edit className="h-4 w-4" strokeWidth={1.75} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No accounts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
