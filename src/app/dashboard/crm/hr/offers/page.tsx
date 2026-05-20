'use client';

/**
 * HR Offers — deep list page (§1D.1).
 *
 * KPI strip (5): Total · Pending acceptance · Accepted · Declined · Expired
 * Filters: status · candidate/job search
 * Bulk: send · revoke · delete
 * Export: CSV
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Download,
  Edit,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import { deleteOffer, getOffers } from '@/app/actions/crm-offers.actions';
import {
  bulkDeleteOffers,
  bulkRevokeOffers,
  bulkSendOffers,
  getOfferKpis,
  type OfferKpis,
} from '@/app/actions/hr.actions';
import type { CrmOfferDoc, CrmOfferStatus } from '@/lib/rust-client/crm-offers';

const BASE = '/dashboard/crm/hr/offers';

const STATUS_OPTIONS: Array<{ value: CrmOfferStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmOfferStatus, StatusTone> = {
  draft: 'amber',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'red',
  withdrawn: 'neutral',
  archived: 'neutral',
};

function pretty(s: string | undefined): string {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amt?: number, currency?: string): string {
  if (amt == null) return '—';
  const ccy = currency ?? 'INR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: 0,
    }).format(amt);
  } catch {
    return `${ccy} ${amt}`;
  }
}

const EMPTY_KPIS: OfferKpis = {
  total: 0,
  sent: 0,
  accepted: 0,
  declined: 0,
  pendingResponse: 0,
  avgNegotiationHours: 0,
};

export default function OffersListPage() {
  const [offers, setOffers] = React.useState<CrmOfferDoc[]>([]);
  const [kpis, setKpis] = React.useState<OfferKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmOfferStatus | 'all'>('all');
  const [jobFilter, setJobFilter] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<CrmOfferDoc | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState<'revoke' | 'delete' | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [bulkPending, startBulkTransition] = React.useTransition();
  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getOffers({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          jobId: jobFilter.trim() || undefined,
          limit: 200,
        }),
        getOfferKpis(),
      ]);
      setOffers(res.items ?? []);
      setKpis(k);
    } catch {
      setOffers([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, jobFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // Derived expired count
  const expiredCount = React.useMemo(
    () => offers.filter((o) => o.status === 'expired').length,
    [offers],
  );

  const allSelected = offers.length > 0 && offers.every((o) => selected.has(o._id));

  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) for (const o of offers) next.add(o._id);
      else for (const o of offers) next.delete(o._id);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const source = selected.size > 0 ? offers.filter((o) => selected.has(o._id)) : offers;
    downloadCsv(
      `offers-${dateStamp()}.csv`,
      ['Candidate', 'Job', 'Salary', 'Status', 'Sent'],
      source.map((o) => ({
        Candidate: o.candidateName || o.candidateId || '',
        Job: o.jobTitle || o.jobId || '',
        Salary: fmtMoney(o.salaryAmount, o.salaryCurrency),
        Status: o.status ?? '',
        Sent: fmtDate(o.sentAt),
      })),
    );
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deleteOffer(id);
      if (result.success) {
        toast({ title: 'Offer deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({ title: 'Error', description: result.error ?? 'Could not delete offer.', variant: 'destructive' });
      }
    });
  };

  const runBulk = (op: 'send' | 'revoke' | 'delete') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      let res: { success: boolean; error?: string };
      if (op === 'send') {
        const r = await bulkSendOffers(ids);
        res = { success: r.success, error: r.error };
      } else if (op === 'revoke') {
        const r = await bulkRevokeOffers(ids);
        res = { success: r.success, error: r.error };
      } else {
        const r = await bulkDeleteOffers(ids);
        res = { success: r.success, error: r.error };
      }
      if (res.success) {
        toast({ title: `${ids.length} offers ${op === 'send' ? 'sent' : op === 'revoke' ? 'revoked' : 'deleted'}` });
        setSelected(new Set());
        setPendingBulk(null);
        await refresh();
      } else {
        toast({ title: 'Bulk action failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <>
      <EntityListShell
        title="Offers"
        subtitle="Offer letters sent to candidates and their response status."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5" /> Export
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onSelect={handleExport}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Download CSV
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New offer
              </Link>
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search offers…' }}
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CrmOfferStatus | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              placeholder="Job id…"
              className="h-9 w-[180px]"
            />
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zoru-ink">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <ZoruButton size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</ZoruButton>
                <ZoruButton size="sm" variant="outline" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export selected
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => runBulk('send')}>
                  Send
                </ZoruButton>
                <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => setPendingBulk('revoke')}>
                  Revoke
                </ZoruButton>
                <ZoruButton size="sm" variant="destructive" disabled={bulkPending} onClick={() => setPendingBulk('delete')}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && offers.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: 'Total offers', value: kpis.total },
              { label: 'Pending acceptance', value: kpis.pendingResponse },
              { label: 'Accepted', value: kpis.accepted },
              { label: 'Declined', value: kpis.declined },
              { label: 'Expired', value: expiredCount },
            ].map((k) => (
              <ZoruCard key={k.label} className="p-3">
                <p className="text-xs text-zoru-ink-muted">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-zoru-ink">{k.value}</p>
              </ZoruCard>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <ZoruCheckbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAll(Boolean(v))}
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Candidate</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Job</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Salary</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Sent</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={7} className="h-24 text-center">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : offers.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
                      No offers match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  offers.map((o) => {
                    const status = (o.status ?? 'draft') as CrmOfferStatus;
                    const tone = STATUS_TONE[status] ?? 'neutral';
                    const isSelected = selected.has(o._id);
                    return (
                      <ZoruTableRow key={o._id} className="border-zoru-line">
                        <ZoruTableCell>
                          <ZoruCheckbox
                            aria-label={`Select offer for ${o.candidateName ?? o.candidateId}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(o._id)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <EntityRowLink
                            href={`${BASE}/${o._id}`}
                            label={o.candidateName || o.candidateId}
                            subtitle={o.jobTitle ?? undefined}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-zoru-ink">
                          {o.jobTitle || o.jobId || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {fmtMoney(o.salaryAmount, o.salaryCurrency)}{' '}
                          <span className="text-zoru-ink-muted">/ {pretty(o.salaryPeriod)}</span>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={pretty(status)} tone={tone} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-zoru-ink">{fmtDate(o.sentAt)}</ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton variant="ghost" size="icon" asChild>
                            <Link href={`${BASE}/${o._id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            variant="ghost"
                            size="icon"
                            onClick={() => setPendingDelete(o)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </ZoruButton>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </div>
      </EntityListShell>

      {/* Single delete */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete offer?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting this offer to{' '}
              <strong>{pendingDelete?.candidateName ?? pendingDelete?.candidateId}</strong>{' '}
              removes it from the active offers list. Audit trail is preserved.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk revoke */}
      <ConfirmDialog
        open={pendingBulk === 'revoke'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Revoke ${selected.size} offers?`}
        description="Their status will be set to withdrawn."
        confirmTone="primary"
        confirmLabel="Revoke all"
        onConfirm={() => runBulk('revoke')}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={pendingBulk === 'delete'}
        onOpenChange={(o) => !o && setPendingBulk(null)}
        title={`Delete ${selected.size} offers?`}
        description="Permanent — cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={() => runBulk('delete')}
      />
    </>
  );
}
