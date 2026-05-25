'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
  Badge,
  Skeleton,
  StatCard,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
} from '@/components/zoruui';
import {
  Archive,
  ArchiveRestore,
  Building,
  CircleDollarSign,
  Download,
  Edit,
  List,
  LoaderCircle,
  Map,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  archiveCrmAccount,
  bulkArchiveCrmAccounts,
  bulkDeleteCrmAccounts,
  unarchiveCrmAccount,
  type CrmAccountKpis,
} from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';
import { ClientsMapView } from '../map-view';
import { fmtINR, fmtDate } from '@/lib/utils';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'archived', label: 'Archived' },
];

const INDUSTRY_OPTIONS = [
  'all', 'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Education', 'Real Estate', 'Hospitality', 'Transportation', 'Media',
  'Construction', 'Legal', 'Consulting', 'Other',
];

interface ClientsListClientProps {
  accounts: WithId<CrmAccount>[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  kpis: CrmAccountKpis | null;
  error?: string;
}

export function ClientsListClient({
  accounts,
  total,
  page,
  limit,
  hasMore,
  initialQuery,
  kpis,
  error,
}: ClientsListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [viewMode, setViewMode] = React.useState<'list' | 'map'>('list');

  const tab = sp?.get('tab') ?? 'active';
  const industryFilter = sp?.get('industry') ?? 'all';
  const statusFilter = sp?.get('status') ?? 'all';
  const engagementFilter = sp?.get('engagement') ?? 'all';

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulkArchive, setPendingBulkArchive] = React.useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();

  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const updateFilter = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (value && value !== 'all') params.set(key, value);
      else params.delete(key);
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, pathname, router],
  );

  const clearFilters = React.useCallback(() => {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.delete('industry');
    params.delete('status');
    params.delete('engagement');
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, pathname, router]);

  const allIds = React.useMemo(() => accounts.map((a) => String(a._id)), [accounts]);
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
      router.refresh();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleUnarchiveAccount = async (accountId: string) => {
    const result = await unarchiveCrmAccount(accountId);
    if (result.success) {
      toast({ title: 'Restored', description: 'Account restored.' });
      router.refresh();
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
      router.refresh();
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
      router.refresh();
    });
  }

  function makeExportRows() {
    return accounts
      .filter((a) => selected.size === 0 || selected.has(String(a._id)))
      .map((a) => ({
        id: String(a._id),
        name: a.name ?? '',
        industry: a.industry ?? '',
        phone: a.phone ?? '',
        email: (a as any).email ?? '',
        status: (a as any).status ?? 'active',
        website: (a as any).website ?? '',
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

  const hasFilterActive = industryFilter !== 'all' || statusFilter !== 'all' || engagementFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Clients & Prospects"
        subtitle="Manage your customer pipeline from prospect to deal."
        primaryAction={
          <>
            <ClientReportButton />
            <CrmAddClientDialog onClientAdded={() => router.refresh()} />
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
            <StatCard label="Total" value={kpis.total.toLocaleString()} />
            <StatCard label="Active" value={kpis.active.toLocaleString()} />
            <StatCard label="Archived" value={kpis.archived.toLocaleString()} />
            <StatCard label="Strategic" value={kpis.strategic.toLocaleString()} />
            <div className="flex flex-1 flex-col gap-1 rounded-md border border-emerald-500/40 bg-zoru-surface-2 px-3 py-2.5">
              <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
                <CircleDollarSign className="h-3 w-3" /> ARR
              </span>
              <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
                {fmtINR(kpis.totalArr)}
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <Card className="overflow-hidden p-0">
          {/* Filter / tab bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={tab === 'active' ? 'default' : 'outline'}
                onClick={() => {
                  updateFilter('tab', 'active');
                  clearSelection();
                }}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={tab === 'archived' ? 'default' : 'outline'}
                onClick={() => {
                  updateFilter('tab', 'archived');
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <Select
              value={industryFilter}
              onValueChange={(v) => updateFilter('industry', v)}
            >
              <SelectTrigger className="h-9 w-[160px] text-[13px]">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind === 'all' ? 'All industries' : ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => updateFilter('status', v)}
            >
              <SelectTrigger className="h-9 w-[150px] text-[13px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={engagementFilter}
              onValueChange={(v) => updateFilter('engagement', v)}
            >
              <SelectTrigger className="h-9 w-[150px] text-[13px]">
                <SelectValue placeholder="Engagement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scores</SelectItem>
                <SelectItem value="high">High (&ge; 80)</SelectItem>
                <SelectItem value="medium">Medium (50-79)</SelectItem>
                <SelectItem value="low">Low (&lt; 50)</SelectItem>
              </SelectContent>
            </Select>
            {hasFilterActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-[12px] text-zoru-ink-muted"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-1 bg-zoru-surface-2 p-1 rounded-md border border-zoru-line">
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                className="h-7 px-2"
                onClick={() => setViewMode('map')}
              >
                <Map className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {viewMode === 'map' ? (
            <div className="border-t border-zoru-line">
              <ClientsMapView accounts={accounts} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zoru-line hover:bg-transparent">
                  <TableHead className="w-[36px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="text-zoru-ink-muted">Account Name</TableHead>
                  <TableHead className="text-zoru-ink-muted">Industry</TableHead>
                  <TableHead className="text-zoru-ink-muted">Phone</TableHead>
                  <TableHead className="text-zoru-ink-muted">Status</TableHead>
                  <TableHead className="text-zoru-ink-muted">Engagement</TableHead>
                  <TableHead className="text-zoru-ink-muted">Last Activity</TableHead>
                  <TableHead className="text-right text-zoru-ink-muted">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length > 0 ? (
                  accounts.map((account) => {
                    const id = account._id.toString();
                    const isSelected = selected.has(id);
                    const status = (account as any).status ?? 'active';
                    const score = account.engagementScore;
                    const lastAct = fmtDate(account.updatedAt || account.createdAt);
                    return (
                      <TableRow
                        key={id}
                        className="border-zoru-line"
                        data-state={isSelected ? 'selected' : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(id)}
                            aria-label={`Select ${account.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/accounts/${id}`}
                            label={
                              <span className="flex items-center gap-2">
                                <Building className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                                {account.name}
                              </span>
                            }
                          />
                        </TableCell>
                        <TableCell className="text-[13px] text-zoru-ink">
                          {account.industry || '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-zoru-ink">
                          {account.phone || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status === 'archived' ? 'ghost' : 'success'}
                            className="capitalize"
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-[13px] font-medium text-zoru-ink">
                            {score !== undefined ? score : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] text-zoru-ink-muted">
                          {lastAct}
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow className="border-zoru-line">
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {hasFilterActive || query
                        ? 'No accounts match these filters.'
                        : 'No accounts found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="mt-4 p-4 border-t border-zoru-line">
            <PaginationBar page={page} limit={limit} hasMore={hasMore} />
          </div>
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
