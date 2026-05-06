'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import { Search, Building, Edit } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { CrmAddAccountDialog } from '@/components/wabasimplify/crm-add-account-dialog';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

import {
  ZoruCard,
  ZoruInput,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../_components/crm-page-header';

const ACCOUNTS_PER_PAGE = 20;

function AccountsPageSkeleton() {
  return (
    <ZoruCard className="p-6">
      <ZoruSkeleton className="h-6 w-48" />
      <ZoruSkeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <ZoruSkeleton className="h-10 w-64" />
      </div>
      <ZoruSkeleton className="mt-4 h-96 w-full" />
    </ZoruCard>
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

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-zoru-ink">All Accounts</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              A list of all companies in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              placeholder="Search by name, industry, or website..."
              className="h-10 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Account Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Industry</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Website</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Created</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={5}>
                      <ZoruSkeleton className="h-10 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : accounts.length > 0 ? (
                accounts.map((account) => (
                  <ZoruTableRow key={account._id.toString()} className="border-zoru-line">
                    <ZoruTableCell>
                      <Link
                        href={`/dashboard/crm/accounts/${account._id.toString()}`}
                        className="flex items-center gap-2 text-[13px] font-medium text-zoru-ink hover:underline"
                      >
                        <Building className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                        {account.name}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {account.industry || 'N/A'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {account.website || 'N/A'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {formatDistanceToNow(new Date(account.createdAt), { addSuffix: true })}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <Link
                        href={`/dashboard/crm/accounts/${account._id.toString()}/edit`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                        aria-label="Edit account"
                      >
                        <Edit className="h-4 w-4" strokeWidth={1.75} />
                      </Link>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No accounts found.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
