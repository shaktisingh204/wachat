'use client';

import { Button, Card, Badge, Input } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  Play,
  Pause,
  Circle,
  Trash2,
  Copy,
  Filter,
  Plus,
  Edit2,
  Check,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

import { cn } from '@/lib/utils';
import * as React from 'react';

import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { AmBreadcrumb } from '../_components/am-page-shell';
import {
  listCampaigns,
  updateEntityStatus,
  deleteCampaign,
  duplicateCampaign,
  updateCampaign,
  getInsights
} from '@/app/actions/ad-manager.actions';
import { formatMoney, formatNumber } from '@/components/zoruui-domain/ad-manager/constants';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
  roas?: number;
};

/* ── Helpers ───────────────────────────────────────────────────── */

function statusVariant(status: string): 'success' | 'warning' | 'ghost' {
  const s = status?.toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'warning';
  return 'ghost';
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
    <div className="divide-y divide-[var(--st-border)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-3.5 w-[180px] rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
          <div className="h-3.5 w-[70px] rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
          <div className="h-3.5 w-[100px] rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
          <div className="ml-auto h-3.5 w-[80px] rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--st-bg-muted)]">
        <Megaphone className="h-6 w-6 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--st-text)]">No campaigns yet</p>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Create your first campaign to start reaching customers on Facebook and Instagram.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => router.push('/dashboard/ad-manager/create')}
      >
        <Plus className="h-3.5 w-3.5" />
        Create campaign
      </Button>
    </div>
  );
}

/* ── No account state ──────────────────────────────────────────── */

function NoAccountState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--st-bg-muted)]">
        <Filter className="h-6 w-6 text-[var(--st-text-secondary)]" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--st-text)]">No ad account selected</p>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          Connect or select a Meta ad account to view your campaigns.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
      >
        Select account
      </Button>
    </div>
  );
}

/* ── Error state ──────────────────────────────────────────── */

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20">
        <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text)]" strokeWidth={2} />
      </div>
      <div>
        <p className="text-[15px] font-semibold text-[var(--st-text)]">Failed to load campaigns</p>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--st-text-secondary)] leading-relaxed">
          {error}
        </p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
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
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-[var(--st-text-secondary)]"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Circle className="h-3.5 w-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-md py-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onToggleStatus();
            }}
          >
            {isPaused ? (
              <Play className="h-3.5 w-3.5 text-[var(--st-text)]" />
            ) : (
              <Pause className="h-3.5 w-3.5 text-[var(--st-text)]" />
            )}
            {isPaused ? 'Activate' : 'Pause'}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
            Duplicate
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main content ─────────────────────────────────────────────────── */

function CampaignsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeAccount, isLoading: accountLoading } = useAdManager();
  const { search } = useAdManagerShell();

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [minRoasFilter, setMinRoasFilter] = React.useState<string>('');
  const [maxCpaFilter, setMaxCpaFilter] = React.useState<string>('');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  
  const [editingBudgetId, setEditingBudgetId] = React.useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = React.useState<string>('');

  const { data: campaignsData, isLoading: campaignsLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns', activeAccount?.account_id],
    queryFn: async () => {
      if (!activeAccount?.account_id) return [];
      const res = await listCampaigns(activeAccount.account_id);
      if (res.error) throw new Error(res.error);
      return res.data as Campaign[];
    },
    enabled: !!activeAccount?.account_id,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['campaign-insights', activeAccount?.account_id],
    queryFn: async () => {
      if (!activeAccount?.account_id) return [];
      const res = await getInsights(activeAccount.account_id, {
        level: 'campaign',
        date_preset: 'maximum',
        fields: ['campaign_id', 'spend', 'actions', 'action_values', 'cost_per_action_type', 'purchase_roas']
      });
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
    enabled: !!activeAccount?.account_id,
  });

  const campaignsWithMetrics = React.useMemo(() => {
    if (!campaignsData) return [];
    
    // Map insights by campaign_id
    const insightsMap = new Map();
    if (insightsData) {
      insightsData.forEach((insight: any) => {
        insightsMap.set(insight.campaign_id, insight);
      });
    }

    return campaignsData.map((c) => {
      const insight = insightsMap.get(c.id);
      let costPerResult = undefined;
      let roas = undefined;

      if (insight) {
        // Try to get CPA from cost_per_action_type (e.g. for conversions/purchases)
        if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
          const action = insight.cost_per_action_type.find((a: any) => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
          if (action) costPerResult = parseFloat(action.value);
        }
        
        if (insight.purchase_roas && insight.purchase_roas.length > 0) {
          const roasAction = insight.purchase_roas.find((a: any) => a.action_type === 'omni_purchase' || a.action_type === 'purchase');
          if (roasAction) roas = parseFloat(roasAction.value);
        }
      }

      return {
        ...c,
        cost_per_result: costPerResult ?? c.cost_per_result,
        roas: roas,
      };
    });
  }, [campaignsData, insightsData]);

  /* Filtered list */
  const filtered = React.useMemo(() => {
    let list = campaignsWithMetrics;
    if (statusFilter !== 'ALL') {
      list = list.filter(
        (c) => c.effective_status?.toUpperCase() === statusFilter,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q));
    }
    if (maxCpaFilter) {
      const maxCpa = Number(maxCpaFilter);
      if (!isNaN(maxCpa)) {
        list = list.filter(c => (c.cost_per_result != null ? c.cost_per_result <= maxCpa : false));
      }
    }
    if (minRoasFilter) {
      const minRoas = Number(minRoasFilter);
      if (!isNaN(minRoas)) {
        list = list.filter(c => (c.roas != null ? c.roas >= minRoas : false));
      }
    }
    return list;
  }, [campaignsWithMetrics, statusFilter, search, maxCpaFilter, minRoasFilter]);

  /* Actions */
  const handleToggleStatus = async (c: Campaign) => {
    const next = c.effective_status?.toUpperCase() === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    setActionLoading(c.id);
    await updateEntityStatus(c.id, 'campaign', next);
    setActionLoading(null);
    queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
  };

  const handleDuplicate = async (c: Campaign) => {
    setActionLoading(c.id);
    await duplicateCampaign(c.id);
    setActionLoading(null);
    queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
  };

  const handleDelete = async (c: Campaign) => {
    setActionLoading(c.id);
    await deleteCampaign(c.id);
    setActionLoading(null);
    queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
  };

  const handleSaveBudget = async (c: Campaign) => {
    setActionLoading(c.id);
    const newVal = Math.round(Number(editingBudgetValue) * 100);
    
    // Optimistic update
    queryClient.setQueryData(['campaigns', activeAccount?.account_id], (old: any) => {
      if (!old) return old;
      return old.map((camp: Campaign) => camp.id === c.id ? { ...camp, daily_budget: newVal.toString() } : camp);
    });

    const res = await updateCampaign(c.id, { daily_budget: newVal });
    if (res.error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
      alert(`Failed to update budget: ${res.error}`);
    }
    setEditingBudgetId(null);
    setActionLoading(null);
  };

  /* No account */
  if (!accountLoading && !activeAccount) {
    return (
      <div>
        <AmBreadcrumb page="Campaigns" />
        <Card className="mt-5">
          <NoAccountState />
        </Card>
      </div>
    );
  }

  const filterPills: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Paused', value: 'PAUSED' },
  ];

  const loading = campaignsLoading || accountLoading;

  return (
    <div>
      {/* Breadcrumbs */}
      <AmBreadcrumb page="Campaigns" />

      {/* Header */}
      <div className="flex items-center justify-between mt-5 mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-semibold text-[var(--st-text)] leading-none">
            Campaigns
          </h1>
          {!loading && (
            <span className="text-[11px] font-medium text-[var(--st-text-secondary)] tabular-nums bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ['id', 'name', 'status', 'objective', 'budget', 'cpa', 'roas'];
              const csvRows = filtered.map((c) => [
                c.id,
                `"${(c.name || '').replace(/"/g, '""')}"`,
                c.effective_status || c.status,
                c.objective || '',
                budgetDisplay(c),
                c.cost_per_result ?? '',
                c.roas ?? '',
              ].join(','));
              const csv = [headers.join(','), ...csvRows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `campaigns-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/dashboard/ad-manager/create')}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          {filterPills.map((pill) => (
            <Button
              key={pill.value}
              variant={statusFilter === pill.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(pill.value)}
            >
              {pill.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <Input 
                type="number"
                placeholder="Max CPA ($)" 
                value={maxCpaFilter} 
                onChange={(e) => setMaxCpaFilter(e.target.value)} 
                className="w-32 h-8 text-sm" 
            />
            <Input 
                type="number"
                placeholder="Min ROAS" 
                value={minRoasFilter} 
                onChange={(e) => setMinRoasFilter(e.target.value)} 
                className="w-32 h-8 text-sm" 
            />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 ml-auto"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
            queryClient.invalidateQueries({ queryKey: ['campaign-insights', activeAccount?.account_id] });
          }}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5 text-[var(--st-text-secondary)]', (loading || insightsLoading) && 'animate-spin')}
            strokeWidth={2}
          />
        </Button>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState error={(error as Error)?.message || 'An unknown error occurred'} onRetry={() => refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/30">
              <span className="flex-1 min-w-[200px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Name
              </span>
              <span className="w-[90px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Status
              </span>
              <span className="w-[140px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Objective
              </span>
              <span className="w-[120px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
                Budget
              </span>
              <span className="w-[70px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide text-right">
                CPA
              </span>
              <span className="w-[70px] text-[11px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide text-right">
                ROAS
              </span>
              <span className="w-[44px]" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--st-border)]">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-[var(--st-bg-muted)]/50',
                    actionLoading === c.id && 'opacity-50 pointer-events-none',
                  )}
                  onClick={() => router.push(`/dashboard/ad-manager/campaigns/${c.id}`)}
                >
                  {/* Name */}
                  <div className="flex-1 min-w-[200px] flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--st-bg-muted)]">
                      <Megaphone className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" strokeWidth={2} />
                    </div>
                    <span className="text-[13px] font-medium text-[var(--st-text)] truncate">
                      {c.name}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-[90px]">
                    <Badge variant={statusVariant(c.effective_status)}>
                      {statusLabel(c.effective_status)}
                    </Badge>
                  </div>

                  {/* Objective */}
                  <span className="w-[140px] text-[13px] text-[var(--st-text-secondary)] truncate">
                    {objectiveLabel(c.objective)}
                  </span>

                  {/* Budget */}
                  <div className="w-[120px] text-[13px] text-[var(--st-text)] tabular-nums flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {editingBudgetId === c.id ? (
                        <div className="flex items-center gap-1">
                            <Input 
                                type="number" 
                                value={editingBudgetValue} 
                                onChange={(e) => setEditingBudgetValue(e.target.value)}
                                className="w-16 h-7 text-xs px-1"
                            />
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--st-text)]" onClick={() => handleSaveBudget(c)}><Check className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--st-text)]" onClick={() => setEditingBudgetId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 group/budget">
                            <span>{budgetDisplay(c)}</span>
                            {c.daily_budget && (
                                <button className="opacity-0 group-hover/budget:opacity-100 text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-opacity" onClick={() => { setEditingBudgetId(c.id); setEditingBudgetValue((Number(c.daily_budget)/100).toString()); }}>
                                    <Edit2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )}
                  </div>

                  {/* CPA */}
                  <span className="w-[70px] text-[13px] text-[var(--st-text)] tabular-nums text-right">
                    {c.cost_per_result != null ? `$${c.cost_per_result.toFixed(2)}` : '-'}
                  </span>

                  {/* ROAS */}
                  <span className="w-[70px] text-[13px] text-[var(--st-text)] tabular-nums text-right">
                    {c.roas != null ? `${c.roas.toFixed(2)}x` : '-'}
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
      </Card>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <CampaignsContent />
    </QueryClientProvider>
  );
}
