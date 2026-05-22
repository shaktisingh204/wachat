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
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
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
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  Building,
  CircleDollarSign,
  Download,
  Edit,
  LoaderCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  archiveCrmAccount,
  bulkArchiveCrmAccounts,
  bulkDeleteCrmAccounts,
  getCrmAccountKpis,
  getCrmAccounts,
  unarchiveCrmAccount,
  type CrmAccountKpis,
} from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';

const ACCOUNTS_PER_PAGE = 20;

type AccountStatus = 'active' | 'inactive' | 'prospect' | 'archived';

const STATUS_OPTIONS: { value: '' | AccountStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'archived', label: 'Archived' },
];

const INDUSTRY_OPTIONS = [
  '', 'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Hospitality', 'Transportation', 'Media',
  'Construction', 'Legal', 'Consulting', 'Other',
];

function fmtMoney(v: number): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `INR ${v.toLocaleString()}`;
  }
}

interface KpiCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
  onClick?: () => void;
}

function KpiCard({ label, value, tone = 'neutral', onClick }: KpiCardProps) {
  const border =
    tone === 'green'
      ? 'border-emerald-500/40'
      : tone === 'amber'
        ? 'border-amber-500/40'
        : tone === 'red'
          ? 'border-rose-500/40'
          : 'border-zoru-line';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-1 flex-col gap-1 rounded-md border bg-zoru-surface-2 px-3 py-2.5 text-left transition-colors ${border} ${onClick ? 'hover:bg-zoru-surface-hover' : ''}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">{value}</span>
    </Tag>
  );
}

export default function CrmClientsPage() {
  const [accounts, setAccounts] = React.useState<WithId<CrmAccount>[]>([]);
  const [kpis, setKpis] = React.useState<CrmAccountKpis | null>(null);
  const [isLoading, startTransition] = React.useTransition();
  const [busy, startBusy] = React.useTransition();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [totalPages, setTotalPages] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'active' | 'archived'>('active');
  const [industryFilter, setIndustryFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulkArchive, setPendingBulkArchive] = React.useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);

  /* Debounce search */
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      const [{ accounts: data, total }, kpiData] = await Promise.all([
        getCrmAccounts(currentPage, ACCOUNTS_PER_PAGE, debouncedQuery, activeTab as 'active' | 'archived' | 'all'),
        getCrmAccountKpis(),
      ]);
      setAccounts(data);
      setTotalPages(Math.ceil(total / ACCOUNTS_PER_PAGE));
      setKpis(kpiData);
    });
  }, [currentPage, debouncedQuery, activeTab]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Client-side filter on top of server rows */
  const filtered = React.useMemo(() => {
    return accounts.filter((a) => {
      if (industryFilter && a.industry !== industryFilter) return false;
      if (statusFilter) {
        const s = (a as WithId<CrmAccount> & { status?: string }).status ?? 'active';
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [accounts, industryFilter, statusFilter]);

  const allIds = React.useMemo(() => filtered.map((a) => String(a._id)), [filtered]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const handleArchiveAccount = async (accountId: string) => {
    const result = await archiveCrmAccount(accountId);
    if (result.success) {
      toast({ title: 'Archived', description: 'Account archived.' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleUnarchiveAccount = async (accountId: string) => {
    const result = await unarchiveCrmAccount(accountId);
    if (result.success) {
      toast({ title: 'Restored', description: 'Account restored.' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  function confirmBulkArchive() {
    startBusy(async () => {
      const res = await bulkArchiveCrmAccounts(Array.from(selected));
      toast({
        title: `Archived ${res.processed}`,
        description: res.error ?? 'Selected accounts archived.',
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkArchive(false);
      fetchData();
    });
  }

  function confirmBulkDelete() {
    startBusy(async () => {
      const res = await bulkDeleteCrmAccounts(Array.from(selected));
      toast({
        title: `Deleted ${res.processed}`,
        description: res.error ?? 'Selected accounts removed.',
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      fetchData();
    });
  }

  function makeExportRows() {
    return filtered
      .filter((a) => selected.size === 0 || selected.has(String(a._id)))
      .map((a) => ({
        id: String(a._id),
        name: a.name ?? '',
        industry: a.industry ?? '',
        phone: a.phone ?? '',
        email: (a as WithId<CrmAccount> & { email?: string }).email ?? '',
        status: (a as WithId<CrmAccount> & { status?: string }).status ?? 'active',
        website: (a as WithId<CrmAccount> & { website?: string }).website ?? '',
      }));
  }

  function bulkExportCsv() {
    const rows = makeExportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows or apply a filter first.' });
      return;
    }
    const headers = Object.keys(rows[0]!);
    downloadCsv(`clients-${dateStamp()}.csv`, headers, rows);
    toast({ title: 'Exported', description: `${rows.length} clients saved to CSV.` });
  }

  function bulkExportXlsx() {
    const rows = makeExportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows or apply a filter first.' });
      return;
    }
    const headers = Object.keys(rows[0]!);
    void downloadXlsx(`clients-${dateStamp()}.xlsx`, headers, rows, 'Clients');
    toast({ title: 'Exported', description: `${rows.length} clients saved to XLSX.` });
  }

  const hasFilterActive = Boolean(industryFilter) || Boolean(statusFilter);

  return (
    <>
      <EntityListShell
        title="Clients & Prospects"
        subtitle="Manage your customer pipeline from prospect to deal."
        primaryAction={
          <>
            <ClientReportButton />
            <CrmAddClientDialog onClientAdded={fetchData} />
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingBulkArchive(true)}
                disabled={busy}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExportXlsx}>
                <Download className="h-3.5 w-3.5" /> Export XLSX
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zoru-danger-ink"
                onClick={() => setPendingBulkDelete(true)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
      >
        {/* KPI strip */}
        {kpis ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <KpiCard label="Total" value={kpis.total.toLocaleString()} />
            <KpiCard label="Active" value={kpis.active.toLocaleString()} tone="green" />
            <KpiCard label="Archived" value={kpis.archived.toLocaleString()} tone="amber" />
            <KpiCard label="Strategic" value={kpis.strategic.toLocaleString()} />
            <div className="flex flex-1 flex-col gap-1 rounded-md border border-emerald-500/40 bg-zoru-surface-2 px-3 py-2.5">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                <CircleDollarSign className="h-3 w-3" /> ARR
              </span>
              <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
                {fmtMoney(kpis.totalArr)}
              </span>
            </div>
          </div>
        ) : null}

        <Card className="overflow-hidden p-0">
          {/* Filter / tab bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={activeTab === 'active' ? 'default' : 'outline'}
                onClick={() => {
                  setActiveTab('active');
                  setCurrentPage(1);
                  clearSelection();
                }}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'archived' ? 'default' : 'outline'}
                onClick={() => {
                  setActiveTab('archived');
                  setCurrentPage(1);
                  clearSelection();
                }}
              >
                Archived
              </Button>
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <Input
                placeholder="Search by name, industry, or website…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <Select
              value={industryFilter || '__all'}
              onValueChange={(v) => setIndustryFilter(v === '__all' ? '' : v)}
            >
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Industry" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {INDUSTRY_OPTIONS.map((ind) => (
                  <ZoruSelectItem key={ind || '__all'} value={ind || '__all'}>
                    {ind || 'All industries'}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Select
              value={statusFilter || '__all'}
              onValueChange={(v) => setStatusFilter(v === '__all' ? '' : v)}
            >
              <ZoruSelectTrigger className="h-9 w-[150px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value || '__all'} value={o.value || '__all'}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            {hasFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIndustryFilter('');
                  setStatusFilter('');
                }}
                className="text-[12px] text-zoru-ink-muted"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            ) : null}
          </div>

          <Table>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-[36px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Account Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Industry</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Phone</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && accounts.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((account) => {
                  const id = account._id.toString();
                  const isSelected = selected.has(id);
                  const status =
                    (account as WithId<CrmAccount> & { status?: string }).status ?? 'active';
                  return (
                    <ZoruTableRow
                      key={id}
                      className="border-zoru-line"
                      data-state={isSelected ? 'selected' : undefined}
                    >
                      <ZoruTableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select ${account.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/accounts/${id}`}
                          label={
                            <span className="flex items-center gap-2">
                              <Building className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                              {account.name}
                            </span>
                          }
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {account.industry || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {account.phone || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge
                          variant={status === 'archived' ? 'ghost' : 'success'}
                          className="capitalize"
                        >
                          {status}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/crm/accounts/${id}/edit`)}
                            aria-label="Edit account"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {status !== 'archived' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchiveAccount(id)}
                              aria-label="Archive account"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUnarchiveAccount(id)}
                              aria-label="Restore account"
                            >
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              ) : (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {hasFilterActive || searchQuery
                      ? 'No accounts match these filters.'
                      : 'No accounts found.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-zoru-line px-4 py-3 text-[13px]">
              <span className="text-zoru-ink-muted">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </EntityListShell>

      {/* Bulk archive */}
      <ZoruAlertDialog
        open={pendingBulkArchive}
        onOpenChange={(o) => !o && setPendingBulkArchive(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Archive {selected.size} accounts?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Archiving hides these accounts from the active list but does not delete their data.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkArchive();
              }}
              disabled={busy}
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Archive
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete */}
      <ZoruAlertDialog
        open={pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {selected.size} accounts?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the selected accounts and cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkDelete();
              }}
              disabled={busy}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
