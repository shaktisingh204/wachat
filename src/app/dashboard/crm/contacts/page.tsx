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
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
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
import { CrmPageHeader } from '../_components/crm-page-header';

const CONTACTS_PER_PAGE = 15;

function ContactsPageSkeleton() {
  return (
    <ZoruCard className="p-6">
      <ZoruSkeleton className="h-6 w-48" />
      <ZoruSkeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-10 w-48" />
      </div>
      <ZoruSkeleton className="mt-4 h-96 w-full" />
    </ZoruCard>
  );
}

export default function CrmContactsPage() {
  const { toast } = useZoruToast();
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

  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
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

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-zoru-ink">Contacts Directory</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              A list of all individuals in your CRM.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              placeholder="Search by name, email, or phone..."
              className="h-10 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Contact Info</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Job Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Lead Score</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Last Activity</ZoruTableHead>
                <ZoruTableHead className="w-[50px]" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={7}>
                      <ZoruSkeleton className="h-16 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : contacts.length > 0 ? (
                contacts.map((contact) => (
                  <ZoruTableRow key={contact._id.toString()} className="border-zoru-line">
                    <ZoruTableCell>
                      <div className="flex items-center gap-3">
                        <ZoruAvatar className="h-9 w-9 border border-zoru-line">
                          <ZoruAvatarImage src={contact.avatarUrl || ''} />
                          <ZoruAvatarFallback className="bg-accent text-[12px] text-accent-foreground">
                            {contact.name?.charAt(0) ?? '?'}
                          </ZoruAvatarFallback>
                        </ZoruAvatar>
                        <div>
                          <Link
                            href={`/dashboard/crm/contacts/${contact._id.toString()}`}
                            className="text-[13px] font-medium text-zoru-ink hover:underline"
                          >
                            {contact.name}
                          </Link>
                          <p className="text-[11.5px] text-zoru-ink-muted">
                            Added {new Date(contact.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1 text-[12.5px] text-zoru-ink">
                        {contact.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-zoru-ink-muted" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-zoru-ink-muted" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {contact.jobTitle || 'N/A'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={leadScoreVariant(contact.leadScore || 0)}>
                        {contact.leadScore || 0}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant="danger">{contact.status}</ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {contact.lastActivity
                        ? new Date(contact.lastActivity).toLocaleDateString()
                        : 'Never'}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruDropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                          <ZoruButton variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </ZoruButton>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent align="end">
                          <ZoruDropdownMenuItem asChild>
                            <Link href={`/dashboard/crm/contacts/${contact._id.toString()}`}>
                              View Details
                            </Link>
                          </ZoruDropdownMenuItem>
                          <ZoruDropdownMenuItem onSelect={() => setDealForContact(contact)}>
                            Create Deal
                          </ZoruDropdownMenuItem>
                          <ZoruDropdownMenuItem
                            className="text-zoru-danger-ink"
                            onSelect={() => setDeleteContactId(contact._id.toString())}
                          >
                            Delete
                          </ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                      </ZoruDropdownMenu>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No contacts found.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      <ZoruAlertDialog
        open={deleteContactId !== null}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this contact?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone. The contact will be permanently removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

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
