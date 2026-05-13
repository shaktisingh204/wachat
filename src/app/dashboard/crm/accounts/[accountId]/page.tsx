'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import type { CrmAccount, CrmContact, WithId } from '@/lib/definitions';
import {
  ArrowLeft,
  Building,
  Link as LinkIcon,
  Mail,
  Phone,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';

import {
  ZoruButton,
  ZoruCard,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';

const CONTACTS_PER_PAGE = 5;

function AccountDetailPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruSkeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <ZoruSkeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <ZoruSkeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function CrmAccountDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const accountId = params.accountId as string;
  const currentPage = Number(searchParams.get('page')) || 1;

  const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
  const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [isLoading, startTransition] = useTransition();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const totalPages = Math.ceil(totalContacts / CONTACTS_PER_PAGE);

  const fetchData = useCallback(() => {
    if (accountId) {
      startTransition(async () => {
        const [fetchedAccount, fetchedContactsData] = await Promise.all([
          getCrmAccountById(accountId),
          getCrmContacts(currentPage, CONTACTS_PER_PAGE, undefined, accountId),
        ]);
        setAccount(fetchedAccount);
        setContacts(fetchedContactsData.contacts);
        setTotalContacts(fetchedContactsData.total);
      });
    }
  }, [accountId, currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePageChange = (newPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(newPage));
    router.push(`?${next.toString()}`);
  };

  if (isLoading || !account) {
    return <AccountDetailPageSkeleton />;
  }

  return (
    <>
      <ComposeEmailDialog
        isOpen={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        initialTo={contacts.map((c) => c.email).join(', ')}
        initialSubject={`Regarding your account: ${account.name}`}
      />
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/crm/accounts"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Back to All Accounts
          </Link>
          <Link
            href={`/dashboard/crm/accounts/${accountId}/activity`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
          >
            View activity
          </Link>
        </div>

        <CrmPageHeader
          title={account.name}
          subtitle={account.industry || 'Account details and contacts'}
          icon={Building}
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <ZoruCard className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-accent">
                  <Building className="h-8 w-8 text-accent-foreground" strokeWidth={1.75} />
                </div>
                <h2 className="text-[16px] font-semibold text-zoru-ink">{account.name}</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  {account.industry || 'N/A'}
                </p>
              </div>

              <div className="mt-5 space-y-3 text-[13px]">
                <ZoruButton
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsComposeOpen(true)}
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Email All Contacts
                </ZoruButton>

                <div className="flex items-center gap-3 pt-1 text-zoru-ink">
                  <LinkIcon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                  {account.website ? (
                    <a
                      href={account.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {account.website}
                    </a>
                  ) : (
                    <span className="text-zoru-ink-muted">No website</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-zoru-ink">
                  <Phone className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                  {account.phone ? (
                    <a href={`tel:${account.phone}`} className="hover:underline">
                      {account.phone}
                    </a>
                  ) : (
                    <span className="text-zoru-ink-muted">N/A</span>
                  )}
                </div>
              </div>
            </ZoruCard>

            <CrmNotes
              recordId={account._id.toString()}
              recordType="account"
              notes={account.notes || []}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <ZoruCard className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
                <h2 className="text-[16px] font-semibold text-zoru-ink">Associated Contacts</h2>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Email</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Job Title</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {contacts.length > 0 ? (
                      contacts.map((contact) => (
                        <ZoruTableRow
                          key={contact._id.toString()}
                          onClick={() =>
                            (window.location.href = `/dashboard/crm/contacts/${contact._id.toString()}`)
                          }
                          className="cursor-pointer border-zoru-line"
                        >
                          <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                            {contact.name}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {contact.email}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {contact.jobTitle || 'N/A'}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    ) : (
                      <ZoruTableRow className="border-zoru-line">
                        <ZoruTableCell
                          colSpan={3}
                          className="h-24 text-center text-[13px] text-zoru-ink-muted"
                        >
                          No contacts associated with this account.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    )}
                  </ZoruTableBody>
                </ZoruTable>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 pt-4">
                  <span className="text-[12.5px] text-zoru-ink-muted">
                    Page {currentPage} of {totalPages}
                  </span>
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
                  </ZoruButton>
                  <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                  </ZoruButton>
                </div>
              )}
            </ZoruCard>
          </div>
        </div>
      </div>
    </>
  );
}
