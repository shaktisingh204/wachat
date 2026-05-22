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
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Button,
  Card,
  ZoruDateRangePicker,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Mail,
  MoreHorizontal,
  Phone,
  Tag,
  Trash2,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import type { WithId } from 'mongodb';
import type { DateRange } from 'react-day-picker';

import {
  bulkContactAction,
  deleteCrmContact,
  getCrmContactKpis,
  getCrmContacts,
  type CrmContactKpis,
} from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { useT } from '@/lib/i18n/client';
import type { CrmContact, CrmAccount, CrmPipeline } from '@/lib/definitions';
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

const CONTACTS_PER_PAGE = 15;

type ContactStatus = CrmContact['status'];
const STATUS_OPTIONS: ContactStatus[] = [
  'new_lead',
  'contacted',
  'qualified',
  'unqualified',
  'customer',
  'imported',
];

const EMPTY_KPIS: CrmContactKpis = {
  total: 0,
  withDeals: 0,
  newsletterSubscribed: 0,
  recentlyAdded: 0,
};

function ContactsPageSkeleton() {
  return (
    <Card className="p-6">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="mt-4 h-96 w-full" />
    </Card>
  );
}

export default function CrmContactsPage() {
  const { toast } = useZoruToast();
  const { t, locale } = useT();

  /* ─── List state ─────────────────────────────────────────────── */
  const [contacts, setContacts] = React.useState<WithId<CrmContact>[]>([]);
  const [accounts, setAccounts] = React.useState<WithId<CrmAccount>[]>([]);
  const [pipelines, setPipelines] = React.useState<CrmPipeline[]>([]);
  const [crmIndustry, setCrmIndustry] = React.useState<string | undefined>();
  const [total, setTotal] = React.useState(0);
  const [kpis, setKpis] = React.useState<CrmContactKpis>(EMPTY_KPIS);
  const [isLoading, startTransition] = React.useTransition();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');

  /* ─── Filters ────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = React.useState<ContactStatus | 'all'>(
    'all',
  );
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [accountFilter, setAccountFilter] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  /* ─── Selection + dialogs ───────────────────────────────────── */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteContactId, setDeleteContactId] = React.useState<string | null>(null);
  const [dealForContact, setDealForContact] =
    React.useState<WithId<CrmContact> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    !!ownerFilter ||
    !!accountFilter ||
    !!tagFilter ||
    !!dateRange?.from ||
    !!dateRange?.to;

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const [contactsResponse, accountsResponse, pipelinesData, sessionData, kpiData] =
        await Promise.all([
          getCrmContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
          getCrmAccounts(1, 1000),
          getCrmPipelines(),
          getSession(),
          getCrmContactKpis(),
        ]);

      let filtered = contactsResponse.contacts;
      if (statusFilter !== 'all') {
        filtered = filtered.filter((c) => c.status === statusFilter);
      }
      if (ownerFilter) {
        filtered = filtered.filter(
          (c) => (c.assignedTo ?? c.owner ?? '') === ownerFilter,
        );
      }
      if (accountFilter) {
        filtered = filtered.filter(
          (c) => String(c.accountId ?? '') === accountFilter,
        );
      }
      if (tagFilter) {
        const tag = tagFilter.trim().toLowerCase();
        filtered = filtered.filter((c) =>
          (c.tags ?? []).some((t) => String(t).toLowerCase().includes(tag)),
        );
      }
      if (dateRange?.from) {
        const fromMs = dateRange.from.getTime();
        filtered = filtered.filter(
          (c) =>
            !!c.createdAt &&
            new Date(c.createdAt as unknown as string).getTime() >= fromMs,
        );
      }
      if (dateRange?.to) {
        const toMs = dateRange.to.getTime() + 86_400_000 - 1;
        filtered = filtered.filter(
          (c) =>
            !!c.createdAt &&
            new Date(c.createdAt as unknown as string).getTime() <= toMs,
        );
      }

      setContacts(filtered);
      setTotal(hasActiveFilters ? filtered.length : contactsResponse.total);
      setAccounts(accountsResponse.accounts);
      setPipelines(pipelinesData);
      setCrmIndustry((sessionData?.user as { crmIndustry?: string } | undefined)?.crmIndustry);
      setKpis(kpiData ?? EMPTY_KPIS);
    });
  }, [
    currentPage,
    searchQuery,
    statusFilter,
    ownerFilter,
    accountFilter,
    tagFilter,
    dateRange,
    hasActiveFilters,
  ]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  const clearFilters = React.useCallback(() => {
    setStatusFilter('all');
    setOwnerFilter('');
    setAccountFilter('');
    setTagFilter('');
    setDateRange(undefined);
    setCurrentPage(1);
  }, []);

  /* ─── Row delete ──────────────────────────────────────────── */
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
      toast({
        title: t('crm.contacts.list.toast.error'),
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const dealStages =
    pipelines[0]?.stages.map((s) => s.name) ||
    getDealStagesForIndustry(crmIndustry) ||
    [];

  /* ─── Selection ───────────────────────────────────────────── */
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = (all: boolean) => {
    setSelected(all ? new Set(contacts.map((c) => c._id.toString())) : new Set());
  };

  /* ─── Bulk actions ────────────────────────────────────────── */
  const runBulk = React.useCallback(
    async (op: 'delete' | 'status' | 'assign', payload?: string) => {
      if (selected.size === 0) return;
      const ids = Array.from(selected);
      const res = await bulkContactAction(ids, op, payload);
      if (res.success) {
        toast({
          title: `${res.processed} contact${res.processed === 1 ? '' : 's'} updated`,
        });
        setSelected(new Set());
        fetchData();
      } else {
        toast({
          title: 'Bulk action failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [selected, fetchData, toast],
  );

  /* ─── Export ──────────────────────────────────────────────── */
  const exportRows = React.useMemo(() => {
    const rows =
      selected.size > 0
        ? contacts.filter((c) => selected.has(c._id.toString()))
        : contacts;
    return rows.map((c) => ({
      Name: c.name,
      Email: c.email,
      Phone: c.phone ?? '',
      Company: c.company ?? '',
      JobTitle: c.jobTitle ?? '',
      Status: c.status,
      LeadScore: c.leadScore ?? 0,
      LeadSource: c.leadSource ?? '',
      AssignedTo: c.assignedTo ?? c.owner ?? '',
      Tags: (c.tags ?? []).join('|'),
      LastActivity: c.lastActivity
        ? new Date(c.lastActivity as unknown as string).toISOString()
        : '',
      CreatedAt: c.createdAt
        ? new Date(c.createdAt as unknown as string).toISOString()
        : '',
    }));
  }, [contacts, selected]);

  const exportHeaders = React.useMemo<string[]>(
    () => [
      'Name',
      'Email',
      'Phone',
      'Company',
      'JobTitle',
      'Status',
      'LeadScore',
      'LeadSource',
      'AssignedTo',
      'Tags',
      'LastActivity',
      'CreatedAt',
    ],
    [],
  );

  const exportCsv = React.useCallback(() => {
    downloadCsv(`contacts-${dateStamp()}.csv`, exportHeaders, exportRows);
  }, [exportHeaders, exportRows]);

  const exportXlsx = React.useCallback(() => {
    void downloadXlsx(
      `contacts-${dateStamp()}.xlsx`,
      exportHeaders,
      exportRows,
      'Contacts',
    );
  }, [exportHeaders, exportRows]);

  const leadScoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
    if (score > 75) return 'success';
    if (score > 50) return 'warning';
    return 'danger';
  };

  const totalPages = Math.max(1, Math.ceil(total / CONTACTS_PER_PAGE));

  if (isLoading && contacts.length === 0) return <ContactsPageSkeleton />;

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <EntityListShell
      title={t('crm.contacts.list.title')}
      subtitle={t('crm.contacts.list.subtitle')}
      search={{
        value: searchQuery,
        onChange: handleSearch,
        placeholder: t('crm.contacts.list.search.placeholder'),
      }}
      primaryAction={<CrmAddContactDialog onAdded={fetchData} accounts={accounts} />}
      filters={
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as ContactStatus | 'all');
                setCurrentPage(1);
              }}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <ZoruSelectItem key={s} value={s}>
                    {s.replace('_', ' ')}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
              Owner
            </Label>
            <input
              type="text"
              placeholder="Owner id / name"
              value={ownerFilter}
              onChange={(e) => {
                setOwnerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink placeholder:text-zoru-ink-muted"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
              Account
            </Label>
            <Select
              value={accountFilter || 'all'}
              onValueChange={(v) => {
                setAccountFilter(v === 'all' ? '' : v);
                setCurrentPage(1);
              }}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Any account</ZoruSelectItem>
                {accounts.map((a) => (
                  <ZoruSelectItem
                    key={a._id.toString()}
                    value={a._id.toString()}
                  >
                    {a.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
              Tag
            </Label>
            <input
              type="text"
              placeholder="Filter by tag"
              value={tagFilter}
              onChange={(e) => {
                setTagFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink placeholder:text-zoru-ink-muted"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
              Created
            </Label>
            <ZoruDateRangePicker
              value={dateRange}
              onChange={(r) => {
                setDateRange(r);
                setCurrentPage(1);
              }}
              placeholder="Any time"
            />
          </div>
          {hasActiveFilters ? (
            <div className="md:col-span-3 lg:col-span-5">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
              <Badge variant="info">{selected.size} selected</Badge>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-zoru-ink-muted hover:text-zoru-ink"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                onValueChange={(v) => void runBulk('status', v)}
              >
                <ZoruSelectTrigger className="h-8 w-[180px] text-[12px]">
                  <Tag className="mr-1.5 h-3.5 w-3.5" />
                  <ZoruSelectValue placeholder="Set status…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <ZoruSelectItem key={s} value={s}>
                      {s.replace('_', ' ')}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const owner = window.prompt('Assign to (user id or name):');
                  if (owner !== null) void runBulk('assign', owner);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportXlsx}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export XLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runBulk('delete')}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        ) : null
      }
      loading={isLoading && contacts.length === 0}
      pagination={
        contacts.length > 0 ? (
          <PaginationBar
            page={currentPage}
            limit={CONTACTS_PER_PAGE}
            hasMore={currentPage < totalPages}
            total={total}
            controlled={{
              onChange: (next) => setCurrentPage(next.page),
            }}
          />
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total contacts"
            value={kpis.total.toLocaleString()}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="With deals"
            value={kpis.withDeals.toLocaleString()}
            icon={<Tag className="h-4 w-4" />}
          />
          <StatCard
            label="Newsletter"
            value={kpis.newsletterSubscribed.toLocaleString()}
            icon={<Mail className="h-4 w-4" />}
          />
          <StatCard
            label="Added (30d)"
            value={kpis.recentlyAdded.toLocaleString()}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        </div>

        <Card className="p-0">
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all contacts"
                      checked={
                        contacts.length > 0 &&
                        contacts.every((c) =>
                          selected.has(c._id.toString()),
                        )
                      }
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.name')}
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.contactInfo')}
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.jobTitle')}
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.leadScore')}
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.status')}
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    {t('crm.contacts.list.col.lastActivity')}
                  </ZoruTableHead>
                  <ZoruTableHead className="w-[50px]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <ZoruTableRow key={i} className="border-zoru-line">
                      <ZoruTableCell colSpan={8}>
                        <Skeleton className="h-16 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : contacts.length > 0 ? (
                  contacts.map((contact) => {
                    const id = contact._id.toString();
                    return (
                      <ZoruTableRow key={id} className="border-zoru-line">
                        <ZoruTableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select ${contact.name}`}
                            checked={selected.has(id)}
                            onChange={() => toggleOne(id)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-zoru-line">
                              <ZoruAvatarImage src={contact.avatarUrl || ''} />
                              <ZoruAvatarFallback className="bg-accent text-[12px] text-accent-foreground">
                                {contact.name?.charAt(0) ?? '?'}
                              </ZoruAvatarFallback>
                            </Avatar>
                            <EntityRowLink
                              href={`/dashboard/crm/contacts/${id}`}
                              label={contact.name}
                              subtitle={t('crm.contacts.list.added', {
                                date: new Date(
                                  contact.createdAt as unknown as string,
                                ).toLocaleDateString(locale),
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
                          {contact.jobTitle ||
                            t('crm.contacts.list.notAvailable')}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge
                            variant={leadScoreVariant(contact.leadScore || 0)}
                          >
                            {contact.leadScore || 0}
                          </Badge>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge variant="danger">{contact.status}</Badge>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {contact.lastActivity
                            ? new Date(
                                contact.lastActivity as unknown as string,
                              ).toLocaleDateString(locale)
                            : t('crm.contacts.list.never')}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                              <ZoruDropdownMenuItem asChild>
                                <Link href={`/dashboard/crm/contacts/${id}`}>
                                  {t('crm.contacts.list.action.viewDetails')}
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                onSelect={() => setDealForContact(contact)}
                              >
                                {t('crm.contacts.list.action.createDeal')}
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                className="text-zoru-danger-ink"
                                onSelect={() => setDeleteContactId(id)}
                              >
                                {t('crm.contacts.list.action.delete')}
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </DropdownMenu>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                ) : (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {t('crm.contacts.list.empty')}
                    </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </Table>
          </div>
        </Card>
      </div>

      <ZoruAlertDialog
        open={deleteContactId !== null}
        onOpenChange={(open) => !open && setDeleteContactId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {t('crm.contacts.list.delete.title')}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {t('crm.contacts.list.delete.description')}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>
              {t('crm.contacts.list.delete.cancel')}
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting
                ? t('crm.contacts.list.delete.confirmInProgress')
                : t('crm.contacts.list.delete.confirm')}
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
