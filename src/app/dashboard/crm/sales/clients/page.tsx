'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import {
  Search,
  Users,
  MoreVertical,
  Archive,
  Edit,
  ArchiveRestore,
  Building,
  } from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  getCrmAccounts,
  archiveCrmAccount,
  unarchiveCrmAccount,
  } from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';

import { CrmPageHeader } from '../../_components/crm-page-header';

const ACCOUNTS_PER_PAGE = 20;

function ClientsPageSkeleton() {
  return (
    <ZoruCard className="p-6">
      <ZoruSkeleton className="h-6 w-48" />
      <ZoruSkeleton className="mt-2 h-4 w-64" />
      <ZoruSkeleton className="mt-6 h-10 w-full" />
      <ZoruSkeleton className="mt-4 h-64 w-full" />
    </ZoruCard>
  );
}

export default function CrmClientsPage() {
  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const { accounts: data, total } = await getCrmAccounts(
        currentPage,
        ACCOUNTS_PER_PAGE,
        searchQuery,
        activeTab as any,
      );
      setAccounts(data);
      setTotalPages(Math.ceil(total / ACCOUNTS_PER_PAGE));
    });
  }, [currentPage, searchQuery, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  const handleArchiveAccount = async (accountId: string) => {
    const result = await archiveCrmAccount(accountId);
    if (result.success) {
      toast({ title: 'Success', description: 'Account archived successfully.' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleUnarchiveAccount = async (accountId: string) => {
    const result = await unarchiveCrmAccount(accountId);
    if (result.success) {
      toast({ title: 'Success', description: 'Account unarchived successfully.' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  if (isLoading && accounts.length === 0) return <ClientsPageSkeleton />;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Clients & Prospects"
        subtitle="Manage your customer pipeline from prospect to deal."
        icon={Users}
        actions={
          <>
            <ClientReportButton />
            <CrmAddClientDialog onClientAdded={fetchData} />
          </>
        }
      />

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] text-zoru-ink">All Accounts</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              A list of all companies in your CRM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              <ZoruButton
                size="sm"
                variant={activeTab === 'active' ? 'default' : 'outline'}
                onClick={() => setActiveTab('active')}
              >
                Active
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant={activeTab === 'archived' ? 'default' : 'outline'}
                onClick={() => setActiveTab('archived')}
              >
                Archived
              </ZoruButton>
            </div>
            <div className="relative w-full max-w-xs">
              <ZoruInput
                placeholder="Search by name, industry, or website..."
                onChange={(e) => handleSearch(e.target.value)}
                defaultValue={searchQuery}
                leadingSlot={<Search />}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Account Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Industry</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Phone</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
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
                        className="flex items-center gap-2 text-[13px] text-zoru-ink hover:underline"
                      >
                        <Building className="h-4 w-4 text-zoru-ink-muted" />
                        {account.name}
                      </Link>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {account.industry || 'N/A'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {account.phone || 'N/A'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={account.status === 'archived' ? 'ghost' : 'success'}
                        className="capitalize"
                      >
                        {account.status || 'active'}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruDropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                          <ZoruButton variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </ZoruButton>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent align="end">
                          <ZoruDropdownMenuItem
                            onSelect={() =>
                              router.push(
                                `/dashboard/crm/accounts/${account._id.toString()}/edit`,
                              )
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </ZoruDropdownMenuItem>
                          {account.status !== 'archived' ? (
                            <ZoruAlertDialog>
                              <ZoruAlertDialogTrigger asChild>
                                <ZoruDropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-zoru-danger-ink focus:bg-zoru-surface-2"
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </ZoruDropdownMenuItem>
                              </ZoruAlertDialogTrigger>
                              <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader>
                                  <ZoruAlertDialogTitle>Archive Account?</ZoruAlertDialogTitle>
                                  <ZoruAlertDialogDescription>
                                    Archiving this account will hide it from the main list but
                                    will not delete its data.
                                  </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                  <ZoruAlertDialogAction
                                    onClick={() =>
                                      handleArchiveAccount(account._id!.toString())
                                    }
                                  >
                                    Archive
                                  </ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                              </ZoruAlertDialogContent>
                            </ZoruAlertDialog>
                          ) : (
                            <ZoruDropdownMenuItem
                              onSelect={() => handleUnarchiveAccount(account._id!.toString())}
                            >
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                              Unarchive
                            </ZoruDropdownMenuItem>
                          )}
                        </ZoruDropdownMenuContent>
                      </ZoruDropdownMenu>
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
