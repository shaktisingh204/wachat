'use client';

import {
  Button,
  Badge,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  DropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Skeleton,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    Plus,
  Filter,
  Columns3,
  SlidersHorizontal,
  Download,
  RefreshCw,
  AlertCircle,
  Megaphone,
  Layers,
  Image as ImageIcon,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { useAdManagerShell } from '@/context/ad-manager-shell-context';
import { MetaDataTable, type MetaRow } from './meta-data-table';
import {
    listCampaigns, listAdSets, listAds,
    updateEntityStatus, deleteCampaign, deleteAdSet, deleteAd,
    duplicateCampaign, duplicateAdSet, duplicateAd,
    batchUpdateStatus, getInsights,
    updateCampaign, updateAdSet, updateAd,
} from '@/app/actions/ad-manager.actions';
import { EFFECTIVE_STATUSES, INSIGHT_COLUMNS } from './constants';

const COLUMN_PRESETS = Object.keys(INSIGHT_COLUMNS);

const BREAKDOWNS = [
    { id: 'none', label: 'None' },
    { id: 'age', label: 'Age' },
    { id: 'gender', label: 'Gender' },
    { id: 'age,gender', label: 'Age + Gender' },
    { id: 'country', label: 'Country' },
    { id: 'region', label: 'Region' },
    { id: 'dma', label: 'DMA' },
    { id: 'publisher_platform', label: 'Placement' },
    { id: 'platform_position', label: 'Platform position' },
    { id: 'device_platform', label: 'Device' },
    { id: 'impression_device', label: 'Impression device' },
    { id: 'hourly_stats_aggregated_by_advertiser_time_zone', label: 'Hour (advertiser TZ)' },
];

function rowsToCsv(rows: MetaRow[]): string {
    const headers = [
        'id', 'name', 'status', 'effective_status', 'objective',
        'budget', 'results', 'reach', 'impressions', 'clicks',
        'ctr', 'cpc', 'cpm', 'spend', 'frequency',
    ];
    const escape = (v: any) => {
        if (v == null) return '';
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
    ];
    return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export type Level = 'campaign' | 'adset' | 'ad';

const LEVEL_META: Record<Level, { label: string; icon: React.ComponentType<{ className?: string }>; linkBase: string }> = {
    campaign: { label: 'Campaigns', icon: Megaphone, linkBase: '/dashboard/ad-manager/campaigns' },
    adset: { label: 'Ad sets', icon: Layers, linkBase: '/dashboard/ad-manager/ad-sets' },
    ad: { label: 'Ads', icon: ImageIcon, linkBase: '/dashboard/ad-manager/ads' },
};

function mergeInsights(rows: any[], insights: any[], level: Level): MetaRow[] {
    const byId = new Map<string, any>();
    for (const i of insights) {
        const key = level === 'campaign' ? i.campaign_id : level === 'adset' ? i.adset_id : i.ad_id;
        if (key) byId.set(key, i);
    }
    return rows.map((r) => {
        const ins = byId.get(r.id) || {};
        const linkClicks = ins.inline_link_clicks ? Number(ins.inline_link_clicks) : undefined;
        const spend = ins.spend ? Number(ins.spend) : undefined;
        return {
            id: r.id,
            name: r.name,
            status: r.status || r.configured_status,
            effective_status: r.effective_status,
            objective: r.objective,
            bid_strategy: r.bid_strategy,
            budget: r.daily_budget
                ? Number(r.daily_budget) / 100
                : r.lifetime_budget
                  ? Number(r.lifetime_budget) / 100
                  : undefined,
            results: ins.actions?.[0]?.value ? Number(ins.actions[0].value) : linkClicks,
            reach: ins.reach ? Number(ins.reach) : undefined,
            impressions: ins.impressions ? Number(ins.impressions) : undefined,
            clicks: ins.clicks ? Number(ins.clicks) : undefined,
            ctr: ins.ctr ? Number(ins.ctr) : undefined,
            cpc: ins.cpc ? Number(ins.cpc) : undefined,
            cpm: ins.cpm ? Number(ins.cpm) : undefined,
            spend,
            cost_per_result: spend && linkClicks ? spend / linkClicks : undefined,
            frequency: ins.frequency ? Number(ins.frequency) : undefined,
            thumbnail: r.creative?.image_url || r.creative?.thumbnail_url,
        };
    });
}

function LevelTabs({
    level,
    setLevel,
    counts,
}: {
    level: Level;
    setLevel: (l: Level) => void;
    counts: Record<Level, number | null>;
}) {
    return (
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
            {(Object.keys(LEVEL_META) as Level[]).map((l) => {
                const meta = LEVEL_META[l];
                const Icon = meta.icon;
                const active = l === level;
                return (
                    <button
                        key={l}
                        type="button"
                        onClick={() => setLevel(l)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            active ? 'bg-[#1877F2] text-white' : 'text-foreground/70 hover:bg-muted'
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {meta.label}
                        {counts[l] != null && (
                            <Badge
                                variant={active ? 'secondary' : 'outline'}
                                className={active ? 'bg-white/20 text-white border-0' : ''}
                            >
                                {counts[l]}
                            </Badge>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

export function CampaignsHub({ initialLevel = 'campaign' }: { initialLevel?: Level }) {
    const router = useRouter();
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const { search, preset, date } = useAdManagerShell();

    const [level, setLevel] = React.useState<Level>(initialLevel);
    const [rows, setRows] = React.useState<MetaRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [statusFilters, setStatusFilters] = React.useState<string[]>(['ACTIVE', 'PAUSED']);
    const [counts, setCounts] = React.useState<Record<Level, number | null>>({
        campaign: null,
        adset: null,
        ad: null,
    });
    const [error, setError] = React.useState<string | null>(null);
    const [columnPreset, setColumnPreset] = React.useState<string>('Performance');
    const [breakdown, setBreakdown] = React.useState<string>('none');
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingName, setEditingName] = React.useState('');
    const [editingBudget, setEditingBudget] = React.useState('');
    const [savingEdit, setSavingEdit] = React.useState(false);

    const refresh = React.useCallback(async () => {
        if (!activeAccount) {
            setLoading(false);
            return;
        }
        setRefreshing(true);
        setError(null);
        try {
            const listFn =
                level === 'campaign'
                    ? () => listCampaigns(activeAccount.account_id)
                    : level === 'adset'
                      ? () => listAdSets(activeAccount.account_id, 'account')
                      : () => listAds(activeAccount.account_id, 'account');
            const res = await listFn();
            if (res.error) {
                setError(res.error);
                setRows([]);
                return;
            }
            const entities = res.data || [];
            setCounts((c) => ({ ...c, [level]: entities.length }));
            const insightRes = await getInsights(`act_${activeAccount.account_id.replace(/^act_/, '')}`, {
                level,
                date_preset: preset && preset !== 'custom' ? preset : 'last_7d',
                time_range:
                    preset === 'custom' && date?.from && date.to
                        ? {
                              since: date.from.toISOString().split('T')[0],
                              until: date.to.toISOString().split('T')[0],
                          }
                        : undefined,
                breakdowns: breakdown && breakdown !== 'none' ? breakdown.split(',') : undefined,
            });
            const merged = mergeInsights(entities, insightRes.data || [], level);
            setRows(merged);
        } catch (e: any) {
            setError(e?.message || 'Failed to load data');
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [activeAccount, level, preset, date, breakdown]);

    React.useEffect(() => {
        setLoading(true);
        setSelectedIds(new Set());
        void refresh();
    }, [refresh]);

    const filteredRows = React.useMemo(() => {
        return rows.filter((r) => {
            if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (statusFilters.length > 0 && !statusFilters.includes((r.status || '').toUpperCase())) return false;
            return true;
        });
    }, [rows, search, statusFilters]);

    const handleToggle = async (id: string, active: boolean) => {
        const prev = rows;
        const newStatus = active ? 'ACTIVE' : 'PAUSED';
        setRows((r) => r.map((x) => (x.id === id ? { ...x, status: newStatus } : x)));
        const result = await updateEntityStatus(id, level, newStatus);
        if (!result.success) {
            setRows(prev);
            toast({ title: 'Update failed', description: result.error, variant: 'destructive' });
        } else {
            toast({
                title: `${newStatus === 'ACTIVE' ? 'Activated' : 'Paused'}`,
                description: `Now ${newStatus.toLowerCase()}.`,
            });
        }
    };

    const handleDelete = async (id: string) => {
        const fn = level === 'campaign' ? deleteCampaign : level === 'adset' ? deleteAdSet : deleteAd;
        const res = await fn(id);
        if (res.error) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Deleted' });
            setRows((r) => r.filter((x) => x.id !== id));
        }
    };

    const handleDuplicate = async (id: string) => {
        const fn = level === 'campaign' ? duplicateCampaign : level === 'adset' ? duplicateAdSet : duplicateAd;
        const res = await fn(id);
        if (res.error) toast({ title: 'Duplicate failed', description: res.error, variant: 'destructive' });
        else {
            toast({ title: 'Duplicated' });
            refresh();
        }
    };

    const openEdit = (id: string) => {
        const row = rows.find((r) => r.id === id);
        if (!row) return;
        setEditingId(id);
        setEditingName(row.name);
        setEditingBudget(row.budget ? String(row.budget) : '');
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSavingEdit(true);
        const patch: Record<string, any> = {};
        const row = rows.find((r) => r.id === editingId);
        if (editingName && editingName !== row?.name) patch.name = editingName;
        if (editingBudget && Number(editingBudget) !== row?.budget) {
            patch.daily_budget = Math.round(Number(editingBudget) * 100);
        }
        const fn = level === 'campaign' ? updateCampaign : level === 'adset' ? updateAdSet : updateAd;
        const res = await fn(editingId, patch);
        setSavingEdit(false);
        if (res.error) {
            toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Saved' });
            setRows((rs) =>
                rs.map((r) =>
                    r.id === editingId
                        ? { ...r, name: editingName || r.name, budget: Number(editingBudget) || r.budget }
                        : r,
                ),
            );
            setEditingId(null);
        }
    };

    const handleExport = () => {
        const csv = rowsToCsv(filteredRows);
        downloadCsv(`${level}-export-${new Date().toISOString().slice(0, 10)}.csv`, csv);
        toast({ title: 'Export ready', description: `${filteredRows.length} rows exported.` });
    };

    const handleBulk = async (status: 'ACTIVE' | 'PAUSED' | 'DELETED') => {
        if (selectedIds.size === 0) return;
        const res = await batchUpdateStatus(Array.from(selectedIds), status);
        if (!res.success) {
            toast({ title: 'Bulk update failed', description: res.errors?.[0], variant: 'destructive' });
        } else {
            toast({ title: `${selectedIds.size} items updated` });
            setSelectedIds(new Set());
            refresh();
        }
    };

    if (!activeAccount) {
        return (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                <Megaphone className="h-16 w-16 text-muted-foreground" />
                <Alert className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to start managing campaigns.</ZoruAlertDescription>
                </Alert>
                <Button asChild>
                    <Link href="/dashboard/ad-manager/ad-accounts">Go to Ad accounts</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
                <LevelTabs level={level} setLevel={setLevel} counts={counts} />
                <div className="flex-1" />
                <Button
                    size="sm"
                    className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                    onClick={() => router.push('/dashboard/ad-manager/create')}
                >
                    <Plus className="h-4 w-4 mr-1" /> Create
                </Button>
                {selectedIds.size > 0 && (
                    <>
                        <div className="h-6 w-px bg-border mx-1" />
                        <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                        <Button variant="outline" size="sm" onClick={() => handleBulk('ACTIVE')}>Activate</Button>
                        <Button variant="outline" size="sm" onClick={() => handleBulk('PAUSED')}>Pause</Button>
                        <Button variant="outline" size="sm" onClick={() => handleBulk('DELETED')}>Delete</Button>
                    </>
                )}
                <div className="h-6 w-px bg-border mx-1" />
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-1" /> Filters
                        </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuLabel>Effective status</ZoruDropdownMenuLabel>
                        <ZoruDropdownMenuSeparator />
                        {EFFECTIVE_STATUSES.slice(0, 6).map((s) => (
                            <ZoruDropdownMenuCheckboxItem
                                key={s}
                                checked={statusFilters.includes(s)}
                                onCheckedChange={(checked) => {
                                    setStatusFilters((prev) =>
                                        checked ? [...prev, s] : prev.filter((x) => x !== s),
                                    );
                                }}
                            >
                                {s}
                            </ZoruDropdownMenuCheckboxItem>
                        ))}
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Columns3 className="h-4 w-4 mr-1" /> Columns: {columnPreset}
                        </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuLabel>Column presets</ZoruDropdownMenuLabel>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuRadioGroup value={columnPreset} onValueChange={setColumnPreset}>
                            {COLUMN_PRESETS.map((p) => (
                                <ZoruDropdownMenuRadioItem key={p} value={p}>{p}</ZoruDropdownMenuRadioItem>
                            ))}
                        </ZoruDropdownMenuRadioGroup>
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <SlidersHorizontal className="h-4 w-4 mr-1" />
                            Breakdown{breakdown !== 'none' && `: ${BREAKDOWNS.find((b) => b.id === breakdown)?.label}`}
                        </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent>
                        <ZoruDropdownMenuLabel>Breakdown</ZoruDropdownMenuLabel>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuRadioGroup value={breakdown} onValueChange={setBreakdown}>
                            {BREAKDOWNS.map((b) => (
                                <ZoruDropdownMenuRadioItem key={b.id} value={b.id}>{b.label}</ZoruDropdownMenuRadioItem>
                            ))}
                        </ZoruDropdownMenuRadioGroup>
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Content */}
            <div>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <ZoruAlertTitle>Error</ZoruAlertTitle>
                        <ZoruAlertDescription>{error}</ZoruAlertDescription>
                    </Alert>
                )}
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : (
                    <MetaDataTable
                        level={level}
                        linkBase={LEVEL_META[level].linkBase}
                        rows={filteredRows}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onEdit={openEdit}
                        selectedIds={selectedIds}
                        setSelectedIds={setSelectedIds}
                    />
                )}
            </div>

            {/* Edit drawer */}
            <Sheet open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
                <ZoruSheetContent side="right" className="w-full sm:max-w-md">
                    <ZoruSheetHeader>
                        <ZoruSheetTitle>Edit {LEVEL_META[level].label.slice(0, -1)}</ZoruSheetTitle>
                        <ZoruSheetDescription>
                            Changes are pushed to Meta immediately.
                        </ZoruSheetDescription>
                    </ZoruSheetHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        </div>
                        {level !== 'ad' && (
                            <div className="space-y-2">
                                <Label>Daily budget</Label>
                                <Input
                                    type="number"
                                    value={editingBudget}
                                    onChange={(e) => setEditingBudget(e.target.value)}
                                    placeholder="e.g. 500"
                                />
                                <p className="text-xs text-muted-foreground">
                                    In account currency (whole units, not cents).
                                </p>
                            </div>
                        )}
                    </div>
                    <ZoruSheetFooter>
                        <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button
                            className="bg-[#1877F2] hover:bg-[#1877F2]/90"
                            onClick={saveEdit}
                            disabled={savingEdit}
                        >
                            {savingEdit ? 'Saving…' : 'Save changes'}
                        </Button>
                    </ZoruSheetFooter>
                </ZoruSheetContent>
            </Sheet>
        </div>
    );
}
