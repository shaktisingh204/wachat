'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Users, Mail, Phone, MoreHorizontal } from 'lucide-react';
import type { WithId } from 'mongodb';

import { getCrmContacts, deleteCrmContact } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import type { CrmContact, CrmAccount, CrmPipeline } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';
import { useToast } from '@/hooks/use-toast';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

const CONTACTS_PER_PAGE = 15;

function ContactsPageSkeleton() {
  return (
    <ClayCard>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="mt-4 h-96 w-full" />
    </ClayCard>
  );
}

export default function CrmContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [crmIndustry, setCrmIndustry] = useState<string | undefined>();
  const [isLoading, startTransition] = useTransition();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [dealForContact, setDealForContact] = useState<WithId<CrmContact> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [contactsResponse, accountsResponse, pipelinesData, sessionData] = await Promise.all([
        getCrmContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
        getCrmAccounts(1, 1000),
        getCrmPipelines(),
        getSession(),
      ]);
      setContacts(contactsResponse.contacts);
      setTotalPages(Math.ceil(contactsResponse.total / CONTACTS_PER_PAGE));
      setAccounts(accountsResponse.accounts);
      setPipelines(pipelinesData);
      setCrmIndustry((sessionData?.user as any)?.crmIndustry);
    });
  }, [currentPage, searchQuery]);

  const handleDelete = async () => {
    if (!deleteContactId) return;
    setIsDeleting(true);
    const res = await deleteCrmContact(deleteContactId);
    setIsDeleting(false);
    if (res.success) {
      toast({ title: 'Contact deleted' });
      setDeleteContactId(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const dealStages =
    pipelines[0]?.stages.map((s) => s.name) ||
    getDealStagesForIndustry(crmIndustry) ||
    [];

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  const leadScoreTone = (score: number): 'green' | 'amber' | 'red' => {
    if (score > 75) return 'green';
    if (score > 50) return 'amber';
    return 'red';
  };

  if (isLoading && contacts.length === 0) return <ContactsPageSkeleton />;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Contacts"
        subtitle="Manage your customer database and personal interactions."
        icon={Users}
        actions={<CrmAddContactDialog onAdded={fetchData} accounts={accounts} />}
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">Contacts Directory</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              A list of all individuals in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
            <Input
              placeholder="Search by name, email, or phone..."
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Name</TableHead>
                <TableHead className="text-clay-ink-muted">Contact Info</TableHead>
                <TableHead className="text-clay-ink-muted">Job Title</TableHead>
                <TableHead className="text-clay-ink-muted">Lead Score</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-clay-ink-muted">Last Activity</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={7}>
                      <Skeleton className="h-16 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : contacts.length > 0 ? (
                contacts.map((contact) => (
                  <TableRow key={contact._id.toString()} className="border-clay-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-clay-border">
                          <AvatarImage src={contact.avatarUrl || ''} />
                          <AvatarFallback className="bg-clay-rose-soft text-[12px] text-clay-rose-ink">
                            {contact.name?.charAt(0) ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/dashboard/crm/contacts/${contact._id.toString()}`}
                            className="text-[13px] font-medium text-clay-ink hover:underline"
                          >
                            {contact.name}
                          </Link>
                          <p className="text-[11.5px] text-clay-ink-muted">
                            Added {new Date(contact.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-[12.5px] text-clay-ink">
                        {contact.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-clay-ink-muted" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-clay-ink-muted" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {contact.jobTitle || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone={leadScoreTone(contact.leadScore || 0)} dot>
                        {contact.leadScore || 0}
                      </ClayBadge>
                    </TableCell>
                    <TableCell>
                      <ClayBadge tone="rose-soft">{contact.status}</ClayBadge>
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {contact.lastActivity
                        ? new Date(contact.lastActivity).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/crm/contacts/${contact._id.toString()}`}>
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDealForContact(contact)}>
                            Create Deal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setDeleteContactId(contact._id.toString())}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-clay-border">
                  <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                    No contacts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <AlertDialog
        open={deleteContactId !== null}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contact will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dealForContact ? (
        <CreateDealDialog
          contacts={contacts}
          accounts={accounts}
          dealStages={dealStages}
          open={!!dealForContact}
          onOpenChange={(open) => !open && setDealForContact(null)}
          hideTrigger
          defaultContactId={dealForContact._id.toString()}
          defaultAccountId={dealForContact.accountId?.toString()}
          onDealCreated={() => {
            setDealForContact(null);
            fetchData();
          }}
        />
      ) : null}
    </div>
  );
}
