'use client';

import {
  Button,
  IconButton,
  Card,
  Badge,
  Field,
  Input,
  SegmentedControl,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import {
  Megaphone,
  Play,
  Pause,
  MoreHorizontal,
  Trash2,
  Copy,
  Filter,
  Plus,
  Edit2,
  Check,
  X,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

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
  getInsights,
} from '@/app/actions/ad-manager.actions';
import { formatMoney } from '@/components/20ui-domain/ad-manager/constants';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  const s = status?.toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'warning';
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
    <div className="divide-y divide-[var(--st-border)]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton width={180} height={14} radius={999} />
          <Skeleton width={70} height={14} radius={999} />
          <Skeleton width={100} height={14} radius={999} />
          <Skeleton width={80} height={14} radius={999} className="ml-auto" />
        </div>
      ))}
    </div>
  );
}

/* ── Main content ─────────────────────────────────────────────────── */

function CampaignsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeAccount, isLoading: accountLoading } = useAdManager();
  const { search } = useAdManagerShell();

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');
  const [minRoasFilter, setMinRoasFilter] = React.useState<string>('');
  const [maxCpaFilter, setMaxCpaFilter] = React.useState<string>('');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const [editingBudgetId, setEditingBudgetId] = React.useState<string | null>(null);
  const [editingBudgetValue, setEditingBudgetValue] = React.useState<string>('');

  const {
    data: campaignsData,
    isLoading: campaignsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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
        fields: ['campaign_id', 'spend', 'actions', 'action_values', 'cost_per_action_type', 'purchase_roas'],
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
          const action = insight.cost_per_action_type.find(
            (a: any) => a.action_type === 'omni_purchase' || a.action_type === 'purchase',
          );
          if (action) costPerResult = parseFloat(action.value);
        }

        if (insight.purchase_roas && insight.purchase_roas.length > 0) {
          const roasAction = insight.purchase_roas.find(
            (a: any) => a.action_type === 'omni_purchase' || a.action_type === 'purchase',
          );
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
      list = list.filter((c) => c.effective_status?.toUpperCase() === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q));
    }
    if (maxCpaFilter) {
      const maxCpa = Number(maxCpaFilter);
      if (!isNaN(maxCpa)) {
        list = list.filter((c) => (c.cost_per_result != null ? c.cost_per_result <= maxCpa : false));
      }
    }
    if (minRoasFilter) {
      const minRoas = Number(minRoasFilter);
      if (!isNaN(minRoas)) {
        list = list.filter((c) => (c.roas != null ? c.roas >= minRoas : false));
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
      return old.map((camp: Campaign) =>
        camp.id === c.id ? { ...camp, daily_budget: newVal.toString() } : camp,
      );
    });

    const res = await updateCampaign(c.id, { daily_budget: newVal });
    if (res.error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
      toast.error(`Failed to update budget: ${res.error}`);
    }
    setEditingBudgetId(null);
    setActionLoading(null);
  };

  /* No account */
  if (!accountLoading && !activeAccount) {
    return (
      <div>
        <AmBreadcrumb page="Campaigns" />
        <Card padding="none" className="mt-5">
          <EmptyState
            icon={Filter}
            title="No ad account selected"
            description="Connect or select a Meta ad account to view your campaigns."
            action={
              <Button
                size="sm"
                variant="primary"
                iconLeft={Plus}
                onClick={() => router.push('/dashboard/ad-manager/ad-accounts')}
              >
                Select account
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const filterItems: { label: string; value: StatusFilter }[] = [
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
          <h1 className="text-[26px] font-semibold text-[var(--st-text)] leading-none">Campaigns</h1>
          {!loading && (
            <Badge tone="neutral" className="tabular-nums">
              {filtered.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ['id', 'name', 'status', 'objective', 'budget', 'cpa', 'roas'];
              const csvRows = filtered.map((c) =>
                [
                  c.id,
                  `"${(c.name || '').replace(/"/g, '""')}"`,
                  c.effective_status || c.status,
                  c.objective || '',
                  budgetDisplay(c),
                  c.cost_per_result ?? '',
                  c.roas ?? '',
                ].join(','),
              );
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
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/dashboard/ad-manager/create')}
          >
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <SegmentedControl<StatusFilter>
          aria-label="Filter campaigns by status"
          size="sm"
          items={filterItems}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <div className="flex items-center gap-2">
          <Field label="Max CPA" className="w-32">
            <Input
              type="number"
              inputSize="sm"
              prefix="$"
              placeholder="0.00"
              value={maxCpaFilter}
              onChange={(e) => setMaxCpaFilter(e.target.value)}
            />
          </Field>
          <Field label="Min ROAS" className="w-32">
            <Input
              type="number"
              inputSize="sm"
              suffix="x"
              placeholder="0.0"
              value={minRoasFilter}
              onChange={(e) => setMinRoasFilter(e.target.value)}
            />
          </Field>
        </div>
        <IconButton
          label="Refresh campaigns"
          icon={RefreshCw}
          variant="ghost"
          size="sm"
          className={cn('ml-auto', (loading || insightsLoading) && '[&_svg]:animate-spin')}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['campaigns', activeAccount?.account_id] });
            queryClient.invalidateQueries({ queryKey: ['campaign-insights', activeAccount?.account_id] });
          }}
        />
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            tone="danger"
            title="Failed to load campaigns"
            description={(error as Error)?.message || 'An unknown error occurred'}
            action={
              <Button size="sm" variant="outline" iconLeft={RefreshCw} onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to start reaching customers on Facebook and Instagram."
            action={
              <Button
                size="sm"
                variant="primary"
                iconLeft={Plus}
                onClick={() => router.push('/dashboard/ad-manager/create')}
              >
                Create campaign
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table density="comfortable" hover>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th width={90}>Status</Th>
                  <Th width={140}>Objective</Th>
                  <Th width={120}>Budget</Th>
                  <Th width={70} align="right">
                    CPA
                  </Th>
                  <Th width={70} align="right">
                    ROAS
                  </Th>
                  <Th width={44} align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {filtered.map((c) => {
                  const isPaused = c.effective_status?.toUpperCase() === 'PAUSED';
                  return (
                    <Tr
                      key={c.id}
                      className={cn(
                        'u-tr--clickable',
                        actionLoading === c.id && 'opacity-50 pointer-events-none',
                      )}
                      tabIndex={0}
                      role="button"
                      onClick={() => router.push(`/dashboard/ad-manager/campaigns/${c.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          router.push(`/dashboard/ad-manager/campaigns/${c.id}`);
                        }
                      }}
                    >
                      {/* Name */}
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                            <Megaphone
                              className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="text-[13px] font-medium text-[var(--st-text)] truncate">
                            {c.name}
                          </span>
                        </div>
                      </Td>

                      {/* Status */}
                      <Td>
                        <Badge tone={statusTone(c.effective_status)}>
                          {statusLabel(c.effective_status)}
                        </Badge>
                      </Td>

                      {/* Objective */}
                      <Td truncate>
                        <span className="text-[13px] text-[var(--st-text-secondary)]">
                          {objectiveLabel(c.objective)}
                        </span>
                      </Td>

                      {/* Budget */}
                      <Td>
                        <div
                          className="flex items-center gap-1 tabular-nums"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {editingBudgetId === c.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                inputSize="sm"
                                className="w-16"
                                aria-label="Daily budget"
                                value={editingBudgetValue}
                                onChange={(e) => setEditingBudgetValue(e.target.value)}
                              />
                              <IconButton
                                label="Save budget"
                                icon={Check}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSaveBudget(c)}
                              />
                              <IconButton
                                label="Cancel budget edit"
                                icon={X}
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingBudgetId(null)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/budget">
                              <span className="text-[13px] text-[var(--st-text)]">
                                {budgetDisplay(c)}
                              </span>
                              {c.daily_budget && (
                                <IconButton
                                  label="Edit budget"
                                  icon={Edit2}
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover/budget:opacity-100 transition-opacity"
                                  onClick={() => {
                                    setEditingBudgetId(c.id);
                                    setEditingBudgetValue((Number(c.daily_budget) / 100).toString());
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </Td>

                      {/* CPA */}
                      <Td align="right">
                        <span className="text-[13px] text-[var(--st-text)] tabular-nums">
                          {c.cost_per_result != null ? `$${c.cost_per_result.toFixed(2)}` : '-'}
                        </span>
                      </Td>

                      {/* ROAS */}
                      <Td align="right">
                        <span className="text-[13px] text-[var(--st-text)] tabular-nums">
                          {c.roas != null ? `${c.roas.toFixed(2)}x` : '-'}
                        </span>
                      </Td>

                      {/* Actions */}
                      <Td align="right">
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <IconButton
                                label="Campaign actions"
                                icon={MoreHorizontal}
                                variant="ghost"
                                size="sm"
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                iconLeft={isPaused ? Play : Pause}
                                onSelect={() => handleToggleStatus(c)}
                              >
                                {isPaused ? 'Activate' : 'Pause'}
                              </DropdownMenuItem>
                              <DropdownMenuItem iconLeft={Copy} onSelect={() => handleDuplicate(c)}>
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="danger"
                                iconLeft={Trash2}
                                onSelect={() => handleDelete(c)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
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
