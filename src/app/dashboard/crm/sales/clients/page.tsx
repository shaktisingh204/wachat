'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const ACCOUNTS_PER_PAGE = 20;

function ClientsPageSkeleton() {
  return (
    <ClayCard>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </ClayCard>
  );
}

export default function CrmClientsPage() {
  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState('active');

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

      <ClayCard>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-clay-ink">All Accounts</h2>
              <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
                A list of all companies in your CRM.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <TabsList className="bg-clay-surface-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                <Input
                  placeholder="Search by name, industry, or website..."
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                  onChange={(e) => handleSearch(e.target.value)}
                  defaultValue={searchQuery}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-clay-md border border-clay-border">
            <Table>
              <TableHeader>
                <TableRow className="border-clay-border hover:bg-transparent">
                  <TableHead className="text-clay-ink-muted">Account Name</TableHead>
                  <TableHead className="text-clay-ink-muted">Industry</TableHead>
                  <TableHead className="text-clay-ink-muted">Phone</TableHead>
                  <TableHead className="text-clay-ink-muted">Status</TableHead>
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
                          <Building className="h-4 w-4 text-clay-ink-muted" />
                          {account.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {account.industry || 'N/A'}
                      </TableCell>
                      <TableCell className="text-[13px] text-clay-ink">
                        {account.phone || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <ClayBadge
                          tone={account.status === 'archived' ? 'neutral' : 'green'}
                          dot
                          className="capitalize"
                        >
                          {account.status || 'active'}
                        </ClayBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                router.push(
                                  `/dashboard/crm/accounts/${account._id.toString()}/edit`,
                                )
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {account.status !== 'archived' ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:bg-destructive/10"
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Archive Account?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Archiving this account will hide it from the main list but
                                      will not delete its data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleArchiveAccount(account._id!.toString())
                                      }
                                    >
                                      Archive
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <DropdownMenuItem
                                onSelect={() => handleUnarchiveAccount(account._id!.toString())}
                              >
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                Unarchive
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        </Tabs>
      </ClayCard>
    </div>
  );
}
