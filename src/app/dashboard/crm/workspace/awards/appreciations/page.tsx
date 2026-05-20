'use client';

/**
 * Appreciations — Deep feed template.
 *
 * KPIs (4): this month · top recipient · top giver · by award type.
 * Filters: search · award (type) · recipient · giver · date range.
 * Bulk delete via row checkboxes. CSV / XLSX export.
 * Feed-style list with avatars + EntityRowLink to /awards/[id].
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
  Award as AwardIcon,
  Calendar,
  Download,
  Heart,
  Plus,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';
import {
  deleteAppreciation,
  getAppreciations,
  getAwards,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsAppreciation,
  WsAward,
} from '@/lib/worksuite/knowledge-types';

type AppRow = WsAppreciation & { _id: string };

interface FilterState {
  search: string;
  awardId: string;
  recipient: string;
  giver: string;
  from: string;
  to: string;
}

const INITIAL: FilterState = {
  search: '',
  awardId: 'all',
  recipient: 'all',
  giver: 'all',
  from: '',
  to: '',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '—';
}

function initials(name: string | undefined, fallbackId: string): string {
  const src = (name || fallbackId || '?').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] ?? '?').toUpperCase() + (parts[1][0] ?? '').toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function isThisMonth(v: unknown): boolean {
  if (!v) return false;
  const d = new Date(v as string | Date);
  if (!Number.isFinite(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function AppreciationsPage(): React.JSX.Element {
  const { toast } = useZoruToast();
  const [apps, setApps] = React.useState<AppRow[]>([]);
  const [awards, setAwards] = React.useState<(WsAward & { _id: string })[]>([]);
  const [loading, startTransition] = React.useTransition();
  const [filters, setFilters] = React.useState<FilterState>(INITIAL);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      try {
        const [ap, aw] = await Promise.all([getAppreciations(), getAwards()]);
        setApps(ap as AppRow[]);
        setAwards(aw as (WsAward & { _id: string })[]);
      } catch (err) {
        toast({
          title: 'Could not load appreciations',
          description: err instanceof Error ? err.message : 'Unknown',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback(
    (v: string) => setFilters((p) => ({ ...p, search: v })),
    200,
  );

  /** Build lookup maps for award titles, recipient / giver names. */
  const awardById = React.useMemo(() => {
    const map = new Map<string, WsAward & { _id: string }>();
    for (const a of awards) map.set(a._id, a);
    return map;
  }, [awards]);

  const recipientOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const a of apps) {
      if (a.given_to_user_id) {
        map.set(a.given_to_user_id, a.given_to_user_name ?? a.given_to_user_id);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [apps]);

  const giverOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const a of apps) {
      if (a.given_by_user_id) {
        map.set(a.given_by_user_id, a.given_by_user_name ?? a.given_by_user_id);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [apps]);

  const visible = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const from = filters.from ? new Date(filters.from).getTime() : null;
    const to = filters.to ? new Date(filters.to).getTime() + 86_400_000 : null;
    return apps.filter((a) => {
      if (q) {
        const hay = `${a.summary ?? ''} ${a.given_to_user_name ?? ''} ${a.given_by_user_name ?? ''} ${awardById.get(a.award_id)?.title ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.awardId !== 'all' && a.award_id !== filters.awardId) return false;
      if (filters.recipient !== 'all' && a.given_to_user_id !== filters.recipient) return false;
      if (filters.giver !== 'all' && a.given_by_user_id !== filters.giver) return false;
      if (from || to) {
        const t = a.given_on ? new Date(a.given_on as string).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (from && t < from) return false;
        if (to && t >= to) return false;
      }
      return true;
    });
  }, [apps, filters, awardById]);

  const kpis = React.useMemo(() => {
    let thisMonth = 0;
    const recipients = new Map<string, { name: string; count: number }>();
    const givers = new Map<string, { name: string; count: number }>();
    const types = new Map<string, number>();
    for (const a of apps) {
      if (isThisMonth(a.given_on)) thisMonth += 1;
      const rid = a.given_to_user_id;
      if (rid) {
        const cur = recipients.get(rid) ?? {
          name: a.given_to_user_name ?? rid,
          count: 0,
        };
        cur.count += 1;
        recipients.set(rid, cur);
      }
      const gid = a.given_by_user_id;
      if (gid) {
        const cur = givers.get(gid) ?? {
          name: a.given_by_user_name ?? gid,
          count: 0,
        };
        cur.count += 1;
        givers.set(gid, cur);
      }
      if (a.award_id) types.set(a.award_id, (types.get(a.award_id) ?? 0) + 1);
    }
    const topR = Array.from(recipients.values()).sort((a, b) => b.count - a.count)[0];
    const topG = Array.from(givers.values()).sort((a, b) => b.count - a.count)[0];
    return {
      thisMonth,
      topRecipient: topR ? `${topR.name} · ${topR.count}` : '—',
      topGiver: topG ? `${topG.name} · ${topG.count}` : '—',
      types,
    };
  }, [apps]);

  const allVisibleIds = React.useMemo(() => visible.map((a) => a._id), [visible]);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleAll = React.useCallback(() => {
    setSelected((cur) => {
      if (allSelected) {
        const n = new Set(cur);
        for (const id of allVisibleIds) n.delete(id);
        return n;
      }
      const n = new Set(cur);
      for (const id of allVisibleIds) n.add(id);
      return n;
    });
  }, [allSelected, allVisibleIds]);

  const toggleOne = React.useCallback((id: string) => {
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteAppreciation(deleteId);
    if (r.success) {
      toast({ title: 'Deleted' });
      setSelected((cur) => {
        const n = new Set(cur);
        n.delete(deleteId);
        return n;
      });
      fetchData();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const r = await deleteAppreciation(id);
      if (r.success) ok += 1;
      else fail += 1;
    }
    toast({
      title: fail === 0 ? 'Deleted' : 'Partial delete',
      description: `${ok} deleted, ${fail} failed.`,
      variant: fail === 0 ? undefined : 'destructive',
    });
    setSelected(new Set());
    setBulkConfirm(false);
    fetchData();
  };

  const buildExportRows = React.useCallback((): ExportRow[] => {
    return visible.map((a) => ({
      Award: awardById.get(a.award_id)?.title ?? a.award_id,
      Recipient: a.given_to_user_name ?? a.given_to_user_id,
      Giver: a.given_by_user_name ?? a.given_by_user_id,
      Given_on: fmtDate(a.given_on),
      Summary: a.summary ?? '',
    }));
  }, [visible, awardById]);

  const headers = ['Award', 'Recipient', 'Giver', 'Given_on', 'Summary'];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = React.useCallback(
    () => downloadCsv(`appreciations-${stamp}.csv`, headers, buildExportRows()),
    [buildExportRows, stamp],
  );
  const exportXlsx = React.useCallback(
    () =>
      downloadXlsx(
        `appreciations-${stamp}.xlsx`,
        headers,
        buildExportRows(),
        'Appreciations',
      ),
    [buildExportRows, stamp],
  );

  const filtersActive =
    filters.search !== '' ||
    filters.awardId !== 'all' ||
    filters.recipient !== 'all' ||
    filters.giver !== 'all' ||
    filters.from !== '' ||
    filters.to !== '';

  const typeBreakdown = React.useMemo(() => {
    return Array.from(kpis.types.entries())
      .map(([awardId, count]) => ({
        name: awardById.get(awardId)?.title ?? awardId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((x) => `${x.name}: ${x.count}`)
      .join(' · ') || '—';
  }, [kpis.types, awardById]);

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <EntityListShell
        title="Appreciations"
        subtitle="Recognitions given to team members."
        search={{
          value: filters.search,
          onChange: (v) => handleSearch(v),
          placeholder: 'Search appreciations…',
        }}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/workspace/awards/appreciations/new">
              <Plus className="h-4 w-4" /> New appreciation
            </Link>
          </ZoruButton>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={filters.awardId}
              onValueChange={(v) => setFilters((p) => ({ ...p, awardId: v }))}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Award" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Any award</ZoruSelectItem>
                {awards.map((a) => (
                  <ZoruSelectItem key={a._id} value={a._id}>
                    {a.title}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={filters.recipient}
              onValueChange={(v) => setFilters((p) => ({ ...p, recipient: v }))}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Recipient" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Any recipient</ZoruSelectItem>
                {recipientOptions.map(([id, name]) => (
                  <ZoruSelectItem key={id} value={id}>
                    {name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={filters.giver}
              onValueChange={(v) => setFilters((p) => ({ ...p, giver: v }))}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Giver" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Any giver</ZoruSelectItem>
                {giverOptions.map(([id, name]) => (
                  <ZoruSelectItem key={id} value={id}>
                    {name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
              className="h-9 w-[150px]"
              aria-label="From"
            />
            <ZoruInput
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
              className="h-9 w-[150px]"
              aria-label="To"
            />
            {filtersActive ? (
              <ZoruButton variant="ghost" size="sm" onClick={() => setFilters(INITIAL)}>
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
            <div className="ml-auto flex gap-1">
              <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </ZoruButton>
              <ZoruButton variant="ghost" size="sm" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </ZoruButton>
            </div>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-zoru-ink">
                {selected.size} selected
              </span>
              <div className="flex gap-2">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
                <ZoruButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        empty={
          !loading && apps.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-4">
              <Heart className="h-6 w-6 text-zoru-ink-muted" />
              <p className="text-sm text-zoru-ink-muted">
                No appreciations yet — celebrate a teammate with the +&nbsp;New
                appreciation button.
              </p>
            </div>
          ) : null
        }
        loading={loading && apps.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ZoruStatCard
              label="This month"
              value={kpis.thisMonth}
              icon={<Heart className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Top recipient"
              value={kpis.topRecipient}
              icon={<Trophy className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Top giver"
              value={kpis.topGiver}
              icon={<Users className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="By award type"
              value={typeBreakdown}
              icon={<AwardIcon className="h-4 w-4" />}
            />
          </div>

          {/* Select-all bar */}
          <div className="flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2 py-1 hover:text-zoru-ink"
            >
              <ZoruCheckbox
                checked={
                  allSelected ? true : someSelected ? 'indeterminate' : false
                }
                onCheckedChange={toggleAll}
                aria-label="Select all visible"
              />
              <span>
                {allSelected
                  ? `Unselect all (${allVisibleIds.length})`
                  : `Select all (${allVisibleIds.length})`}
              </span>
            </button>
            <span>{visible.length} appreciation{visible.length === 1 ? '' : 's'}</span>
          </div>

          {/* Feed */}
          <div className="flex flex-col gap-3">
            {visible.length === 0 ? (
              <ZoruCard className="flex min-h-[120px] items-center justify-center text-sm text-zoru-ink-muted">
                No appreciations match the current filters.
              </ZoruCard>
            ) : null}

            {visible.map((a) => {
              const award = awardById.get(a.award_id);
              const isSelected = selected.has(a._id);
              return (
                <ZoruCard
                  key={a._id}
                  className={`flex flex-col gap-2 p-4 ${
                    isSelected ? 'ring-2 ring-zoru-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ZoruCheckbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(a._id)}
                      aria-label="Select appreciation"
                      className="mt-1"
                    />
                    <ZoruAvatar className="h-9 w-9">
                      <ZoruAvatarFallback>
                        {initials(a.given_to_user_name, a.given_to_user_id)}
                      </ZoruAvatarFallback>
                    </ZoruAvatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <EntityRowLink
                          href={
                            award
                              ? `/dashboard/crm/workspace/awards/${award._id}`
                              : `/dashboard/crm/workspace/awards/appreciations/${a._id}`
                          }
                          label={
                            <span className="inline-flex items-center gap-1.5">
                              <Trophy className="h-3.5 w-3.5 text-amber-500" />
                              {award?.title ?? 'Appreciation'}
                            </span>
                          }
                          subtitle={
                            <span className="inline-flex items-center gap-1 text-[12px]">
                              <span className="font-medium">
                                {a.given_by_user_name ?? a.given_by_user_id}
                              </span>{' '}
                              recognised{' '}
                              <span className="font-medium">
                                {a.given_to_user_name ?? a.given_to_user_id}
                              </span>
                            </span>
                          }
                        />
                        {award?.frequency ? (
                          <ZoruBadge variant="warning" className="capitalize">
                            {award.frequency}
                          </ZoruBadge>
                        ) : null}
                        <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-zoru-ink-muted">
                          <Calendar className="h-3 w-3" /> {fmtDate(a.given_on)}
                        </span>
                      </div>
                      {a.summary ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">
                          {a.summary}
                        </p>
                      ) : null}
                    </div>
                    <ZoruButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(a._id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ZoruButton>
                  </div>
                </ZoruCard>
              );
            })}
          </div>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this appreciation?"
        description="The recognition will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} appreciations?`}
        description="The selected recognitions will be permanently removed."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
