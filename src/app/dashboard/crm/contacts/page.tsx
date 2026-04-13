'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Search, Users, Mail, Phone, MoreHorizontal } from 'lucide-react';
import type { WithId } from 'mongodb';

import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmContact, CrmAccount } from '@/lib/definitions';
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
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';

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
  const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [isLoading, startTransition] = useTransition();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(0);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [contactsResponse, accountsResponse] = await Promise.all([
        getCrmContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
        getCrmAccounts(1, 1000),
      ]);
      setContacts(contactsResponse.contacts);
      setTotalPages(Math.ceil(contactsResponse.total / CONTACTS_PER_PAGE));
      setAccounts(accountsResponse.accounts);
    });
  }, [currentPage, searchQuery]);

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
                          <DropdownMenuItem>Create Deal</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
    </div>
  );
}
