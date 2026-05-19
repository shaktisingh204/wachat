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
import {
  useState,
  useEffect,
  useCallback,
  useTransition } from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import { Search,
  Mail,
  Phone,
  MoreHorizontal } from 'lucide-react';
import type { WithId } from 'mongodb';

import { getCrmContacts,
  deleteCrmContact } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { useT } from '@/lib/i18n/client';
import type { CrmContact,
  CrmAccount,
  CrmPipeline } from '@/lib/definitions';
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

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
  const { t, locale } = useT();
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
      toast({ title: t('crm.contacts.list.toast.deleted') });
      setDeleteContactId(null);
      fetchData();
    } else {
      toast({ title: t('crm.contacts.list.toast.error'), description: res.error, variant: 'destructive' });
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
    <EntityListShell
      title={t('crm.contacts.list.title')}
      subtitle={t('crm.contacts.list.subtitle')}
      primaryAction={<CrmAddContactDialog onAdded={fetchData} accounts={accounts} />}
    >

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-zoru-ink">{t('crm.contacts.list.directoryTitle')}</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              {t('crm.contacts.list.directorySubtitle')}
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <ZoruInput
              placeholder={t('crm.contacts.list.search.placeholder')}
              className="h-10 rounded-lg border-zoru-line bg-zoru-bg pl-9 text-[13px]"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.name')}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.contactInfo')}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.jobTitle')}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.leadScore')}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.status')}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">{t('crm.contacts.list.col.lastActivity')}</ZoruTableHead>
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
                        <EntityRowLink
                          href={`/dashboard/crm/contacts/${contact._id.toString()}`}
                          label={contact.name}
                          subtitle={t('crm.contacts.list.added', {
                            date: new Date(contact.createdAt).toLocaleDateString(locale),
                          })}
                        />
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
                      {contact.jobTitle || t('crm.contacts.list.notAvailable')}
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
                        ? new Date(contact.lastActivity).toLocaleDateString(locale)
                        : t('crm.contacts.list.never')}
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
                              {t('crm.contacts.list.action.viewDetails')}
                            </Link>
                          </ZoruDropdownMenuItem>
                          <ZoruDropdownMenuItem onSelect={() => setDealForContact(contact)}>
                            {t('crm.contacts.list.action.createDeal')}
                          </ZoruDropdownMenuItem>
                          <ZoruDropdownMenuItem
                            className="text-zoru-danger-ink"
                            onSelect={() => setDeleteContactId(contact._id.toString())}
                          >
                            {t('crm.contacts.list.action.delete')}
                          </ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                      </ZoruDropdownMenu>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    {t('crm.contacts.list.empty')}
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
            <ZoruAlertDialogTitle>{t('crm.contacts.list.delete.title')}</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {t('crm.contacts.list.delete.description')}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>{t('crm.contacts.list.delete.cancel')}</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('crm.contacts.list.delete.confirmInProgress') : t('crm.contacts.list.delete.confirm')}
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
    </EntityListShell>
  );
}
