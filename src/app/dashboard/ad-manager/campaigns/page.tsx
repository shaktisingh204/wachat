'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  LuMegaphone,
  LuPlay,
  LuPause,
  LuCircle,
  LuTrash2,
  LuCopy,
  LuArrowRight,
  LuFilter,
  LuSearch,
  LuRefreshCw,
  LuPlus,
} from 'react-icons/lu';

import { cn } from '@/lib/utils';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge, ClayInput } from '@/components/clay';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '../layout';
import {
  listCampaigns,
  updateEntityStatus,
  deleteCampaign,
  duplicateCampaign,
} from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber } from '@/components/wabasimplify/ad-manager/constants';

/* ── Types ─────────────────────────────────────────────────────── */

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED';

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  results?: number;
  cost_per_result?: number;
  spend?: string;
  created_time?: string;
};

/* ── Helpers ───────────────────────────────────────────────────── */

function statusTone(status: string): 'green' | 'amber' | 'neutral' {
  const s = status?.toUpperCase();
  if (s === 'ACTIVE') return 'green';
  if (s === 'PAUSED') return 'amber';
  return 'neutral';
}

function statusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

function objectiveLabel(obj: string): string {
  if (!obj) return '-';
  return obj
    .replace(/^OUTCOME_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function budgetDisplay(c: Campaign): string {
  if (c.daily_budget) return `${formatMoney(Number(c.daily_budget) / 100)}/day`;
  if (c.lifetime_budget) return `${formatMoney(Number(c.lifetime_budget) / 100)} lifetime`;
  return '-';
}

/* ── Skeleton ──────────────────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div className="divide-y divide-clay-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3.5 w-[180px] rounded-full bg-clay-bg-2 animate-pulse" />
          <div className="h-3.5 w-[70px] rounded-full bg-clay-bg-2 animate-pulse" />
          <div className="h-3.5 w-[100px] rounded-full bg-clay-bg-2 animate-pulse" />
          <div className="ml-auto h-3.5 w-[80px] rounded-full bg-clay-bg-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────── */

function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay-bg-2">
        <LuMegaphone className="h-6 w-6 text-clay-ink-muted" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-clay-ink">No campaigns yet</p>
        <p className="mt-1 max-w-sm text-[13px] text-clay-ink-muted leading-relaxed">
          Create your first campaign to start reaching customers on Facebook and Instagram.
        </p>
      </div>
      <ClayButton
        variant="obsidian"
        size="sm"
        onClick={() => router.push('/dashboard/ad-manager/create')}
        leading={<LuPlus className="h-3.5 w-3.5" />}
      >
        Create campaign
      </ClayButton>
    </div>
  );
}

/* ── No account state ──────────────────────────────────────────── */

function NoAccountState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay-bg-2">
        <LuFilter className="h-6 w-6 text-clay-ink-muted" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-clay-ink">No ad account selected</p>
        <p className="mt-1 max-w-sm text-[13px] text-clay-ink-muted leading-relaxed">
          Connect or select a Meta ad account to view your campaigns.
        </p>
      </div>
      <ClayButton
        variant="obsidian"
        size="sm"
        onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
      >
        Select account
      </ClayButton>
    </div>
  );
}

/* ── Row actions dropdown ──────────────────────────────────────── */

function RowActions({
  campaign,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: {
  campaign: Campaign;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isPaused = campaign.effective_status?.toUpperCase() === 'PAUSED';

  return (
    <div ref={ref} className="relative">
      <ClayButton
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-clay-ink-muted"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <LuCircle className="h-3.5 w-3.5" />
      </ClayButton>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-clay-lg border border-clay-border bg-clay-surface shadow-clay-float py-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-clay-ink hover:bg-clay-bg-2/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onToggleStatus();
            }}
          >
            {isPaused ? (
              <LuPlay className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <LuPause className="h-3.5 w-3.5 text-amber-600" />
            )}
            {isPaused ? 'Activate' : 'Pause'}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-clay-ink hover:bg-clay-bg-2/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDuplicate();
            }}
          >
            <LuCopy className="h-3.5 w-3.5 text-clay-ink-muted" />
            Duplicate
          </button>
          <div className="my-1 h-px bg-clay-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            <LuTrash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */

export default function CampaignsPage() {
  const router = useRouter();
  const { activeAccount, isLoading: accountLoading } = useAdManager();
  const { search } = useAdManagerShell();

  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  /* Fetch campaigns */
  React.useEffect(() => {
    if (!activeAccount) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    listCampaigns(activeAccount.account_id).then((res) => {
      if (cancelled) return;
      if (res.data) setCampaigns(res.data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeAccount, refreshKey]);

  /* Filtered list */
  const filtered = React.useMemo(() => {
    let list = campaigns;
    if (statusFilter !== 'ALL') {
      list = list.filter(
        (c) => c.effective_status?.toUpperCase() === statusFilter,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, statusFilter, search]);

  /* Actions */
  const handleToggleStatus = async (c: Campaign) => {
    const next = c.effective_status?.toUpperCase() === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    setActionLoading(c.id);
    await updateEntityStatus(c.id, 'campaign', next);
    setActionLoading(null);
    setRefreshKey((k) => k + 1);
  };

  const handleDuplicate = async (c: Campaign) => {
    setActionLoading(c.id);
    await duplicateCampaign(c.id);
    setActionLoading(null);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = async (c: Campaign) => {
    setActionLoading(c.id);
    await deleteCampaign(c.id);
    setActionLoading(null);
    setRefreshKey((k) => k + 1);
  };

  /* No account */
  if (!accountLoading && !activeAccount) {
    return (
      <div>
        <ClayBreadcrumbs
          items={[
            { label: 'SabNode', href: '/dashboard' },
            { label: 'Meta Suite', href: '/dashboard/ad-manager' },
            { label: 'Campaigns' },
          ]}
          className="mb-5"
        />
        <ClayCard>
          <NoAccountState />
        </ClayCard>
      </div>
    );
  }

  const filterPills: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Paused', value: 'PAUSED' },
  ];

  return (
    <div>
      {/* Breadcrumbs */}
      <ClayBreadcrumbs
        items={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'Meta Suite', href: '/dashboard/ad-manager' },
          { label: 'Campaigns' },
        ]}
        className="mb-5"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-semibold text-clay-ink leading-none">
            Campaigns
          </h1>
          {!loading && (
            <span className="text-[11px] font-medium text-clay-ink-muted tabular-nums bg-clay-bg-2 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          {filterPills.map((pill) => (
            <ClayButton
              key={pill.value}
              variant={statusFilter === pill.value ? 'obsidian' : 'pill'}
              size="sm"
              onClick={() => setStatusFilter(pill.value)}
            >
              {pill.label}
            </ClayButton>
          ))}
        </div>
        <ClayButton
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <LuRefreshCw
            className={cn('h-3.5 w-3.5 text-clay-ink-muted', loading && 'animate-spin')}
            strokeWidth={2}
          />
        </ClayButton>
      </div>

      {/* Table */}
      <ClayCard padded={false}>
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-clay-border bg-clay-bg-2/30">
              <span className="flex-1 min-w-[200px] text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Name
              </span>
              <span className="w-[90px] text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Status
              </span>
              <span className="w-[140px] text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide">
                Objective
              </span>
              <span className="w-[120px] text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide text-right">
                Budget
              </span>
              <span className="w-[80px] text-[11px] font-medium text-clay-ink-muted uppercase tracking-wide text-right">
                Results
              </span>
              <span className="w-[44px]" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-clay-border">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-clay-bg-2/50',
                    actionLoading === c.id && 'opacity-50 pointer-events-none',
                  )}
                  onClick={() => router.push(`/dashboard/ad-manager/campaigns/${c.id}`)}
                >
                  {/* Name */}
                  <div className="flex-1 min-w-[200px] flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-lg bg-clay-bg-2">
                      <LuMegaphone className="h-3.5 w-3.5 text-clay-ink-muted" strokeWidth={2} />
                    </div>
                    <span className="text-[13px] font-medium text-clay-ink truncate">
                      {c.name}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-[90px]">
                    <ClayBadge tone={statusTone(c.effective_status)} dot>
                      {statusLabel(c.effective_status)}
                    </ClayBadge>
                  </div>

                  {/* Objective */}
                  <span className="w-[140px] text-[13px] text-clay-ink-muted truncate">
                    {objectiveLabel(c.objective)}
                  </span>

                  {/* Budget */}
                  <span className="w-[120px] text-[13px] text-clay-ink tabular-nums text-right">
                    {budgetDisplay(c)}
                  </span>

                  {/* Results */}
                  <span className="w-[80px] text-[13px] text-clay-ink tabular-nums text-right">
                    {c.results != null ? formatNumber(c.results) : '-'}
                  </span>

                  {/* Actions */}
                  <div className="w-[44px] flex justify-end">
                    <RowActions
                      campaign={c}
                      onToggleStatus={() => handleToggleStatus(c)}
                      onDuplicate={() => handleDuplicate(c)}
                      onDelete={() => handleDelete(c)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ClayCard>
    </div>
  );
}
