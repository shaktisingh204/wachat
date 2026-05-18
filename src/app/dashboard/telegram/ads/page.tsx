'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruChartContainer,
  ZoruCheckbox,
  ZoruDateRangePicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Link as LinkIcon,
  AlertCircle,
  } from 'lucide-react';
import {
    Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    listTelegramAdsPagedAction,
    upsertTelegramAdAction,
    deleteTelegramAdAction,
    getTelegramAdsAnalyticsAction,
    importTelegramAdsCsvAction,
    exportTelegramAdsCsvAction,
    bulkDeleteTelegramAdsAction,
    buildTelegramAdsUtmAction,
} from '@/app/actions/telegram-extra.actions';
import type {
    CampaignRow,
    AnalyticsResp,
    ListResp,
} from '@/lib/rust-client/telegram-ads';

const ACCENT = '#229ED9';
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'ghost' | 'info' | 'secondary'> = {
    active: 'success',
    paused: 'warning',
    draft: 'ghost',
    completed: 'info',
};

function fmtCurrencyCents(cents: number): string {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNumber(n: number): string {
    return n.toLocaleString();
}
function pctCtr(impr: number, clk: number): number {
    if (!impr) return 0;
    return (clk / impr) * 100;
}
function fmtDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString();
    } catch {
        return iso;
    }
}
function isoDayStart(d: Date): string {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.toISOString();
}
function isoDayEnd(d: Date): string {
    const c = new Date(d);
    c.setHours(23, 59, 59, 999);
    return c.toISOString();
}

interface FormState {
    campaignId?: string;
    name: string;
    status: string;
    platformId: string;
    landingUrl: string;
    budgetDollars: string;
    impressions: string;
    clicks: string;
    notes: string;
}

const EMPTY_FORM: FormState = {
    name: '',
    status: 'draft',
    platformId: '',
    landingUrl: '',
    budgetDollars: '',
    impressions: '0',
    clicks: '0',
    notes: '',
};

function validateForm(f: FormState): string | null {
    if (!f.name.trim()) return 'Name is required.';
    if (f.budgetDollars && Number.isNaN(Number(f.budgetDollars))) return 'Budget must be a number.';
    if (f.impressions && Number.isNaN(Number(f.impressions))) return 'Impressions must be a number.';
    if (f.clicks && Number.isNaN(Number(f.clicks))) return 'Clicks must be a number.';
    return null;
}

export default function TelegramAdsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    const [data, setData] = React.useState<ListResp | null>(null);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [analyticsLoading, setAnalyticsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState('');
    const [searchDebounced, setSearchDebounced] = React.useState('');
    const [status, setStatus] = React.useState<StatusFilter>('all');
    const [range, setRange] = React.useState<{ from?: Date; to?: Date }>(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 29);
        return { from, to };
    });
    const [page, setPage] = React.useState(1);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editorForm, setEditorForm] = React.useState<FormState>(EMPTY_FORM);
    const [savingEditor, setSavingEditor] = React.useState(false);
    const [editorErr, setEditorErr] = React.useState<string | null>(null);

    const [importOpen, setImportOpen] = React.useState(false);
    const [importCsv, setImportCsv] = React.useState('');
    const [importMode, setImportMode] = React.useState<'append' | 'replace_stats'>('append');
    const [importing, setImporting] = React.useState(false);

    const [utmOpen, setUtmOpen] = React.useState(false);
    const [utmRow, setUtmRow] = React.useState<CampaignRow | null>(null);
    const [utmResult, setUtmResult] = React.useState<{ shortUrl: string; longUrl: string } | null>(null);
    const [utmLoading, setUtmLoading] = React.useState(false);
    const [utmCopy, setUtmCopy] = React.useState(false);

    const [deleteRow, setDeleteRow] = React.useState<CampaignRow | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    React.useEffect(() => {
        const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    React.useEffect(() => {
        setPage(1);
    }, [searchDebounced, status, range.from, range.to, projectId]);

    const reload = React.useCallback(async () => {
        if (!projectId) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        const res = await listTelegramAdsPagedAction({
            projectId,
            page,
            pageSize: PAGE_SIZE,
            status: status === 'all' ? undefined : status,
            search: searchDebounced || undefined,
            createdFrom: range.from ? isoDayStart(range.from) : undefined,
            createdTo: range.to ? isoDayEnd(range.to) : undefined,
        });
        setData(res);
        setLoading(false);
        if (res.error) setError(res.error);
    }, [projectId, page, status, searchDebounced, range.from, range.to]);

    const reloadAnalytics = React.useCallback(async () => {
        if (!projectId) {
            setAnalytics(null);
            setAnalyticsLoading(false);
            return;
        }
        setAnalyticsLoading(true);
        const res = await getTelegramAdsAnalyticsAction({
            projectId,
            from: range.from ? isoDayStart(range.from) : undefined,
            to: range.to ? isoDayEnd(range.to) : undefined,
        });
        setAnalytics(res);
        setAnalyticsLoading(false);
    }, [projectId, range.from, range.to]);

    React.useEffect(() => {
        void reload();
    }, [reload]);
    React.useEffect(() => {
        void reloadAnalytics();
    }, [reloadAnalytics]);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    function openCreate() {
        setEditorForm(EMPTY_FORM);
        setEditorErr(null);
        setEditorOpen(true);
    }
    function openEdit(row: CampaignRow) {
        setEditorForm({
            campaignId: row._id,
            name: row.name,
            status: row.status || 'draft',
            platformId: row.platformId ?? '',
            landingUrl: row.landingUrl ?? '',
            budgetDollars: row.budgetCents ? (row.budgetCents / 100).toString() : '',
            impressions: String(row.impressions ?? 0),
            clicks: String(row.clicks ?? 0),
            notes: row.notes ?? '',
        });
        setEditorErr(null);
        setEditorOpen(true);
    }

    async function saveEditor() {
        if (!projectId) return;
        const v = validateForm(editorForm);
        if (v) {
            setEditorErr(v);
            return;
        }
        setSavingEditor(true);
        const res = await upsertTelegramAdAction({
            projectId,
            campaignId: editorForm.campaignId,
            name: editorForm.name.trim(),
            status: editorForm.status,
            platformId: editorForm.platformId.trim() || undefined,
            landingUrl: editorForm.landingUrl.trim() || undefined,
            budgetCents: editorForm.budgetDollars ? Math.round(Number(editorForm.budgetDollars) * 100) : 0,
            impressions: Number(editorForm.impressions || 0),
            clicks: Number(editorForm.clicks || 0),
            notes: editorForm.notes,
        });
        setSavingEditor(false);
        if (res.success) {
            toast({ title: 'Saved', description: res.message ?? 'Campaign saved.' });
            setEditorOpen(false);
            void reload();
            void reloadAnalytics();
        } else {
            setEditorErr(res.error ?? 'Failed to save.');
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to save campaign.',
                variant: 'destructive',
            });
        }
    }

    async function confirmDelete() {
        if (!deleteRow || !projectId) return;
        const res = await deleteTelegramAdAction(deleteRow._id, projectId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Campaign removed.' });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(deleteRow._id);
                return next;
            });
            setDeleteRow(null);
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to delete.',
                variant: 'destructive',
            });
        }
    }

    async function confirmBulkDelete() {
        if (!projectId || selected.size === 0) return;
        const ids = Array.from(selected);
        const res = await bulkDeleteTelegramAdsAction({ projectId, ids });
        if (res.success) {
            toast({
                title: 'Deleted',
                description: `${res.deleted} campaign${res.deleted === 1 ? '' : 's'} removed.`,
            });
            setSelected(new Set());
            setBulkDeleteOpen(false);
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Bulk delete failed.',
                variant: 'destructive',
            });
        }
    }

    async function runImport() {
        if (!projectId) return;
        if (!importCsv.trim()) {
            toast({ title: 'Empty CSV', description: 'Paste CSV content first.', variant: 'destructive' });
            return;
        }
        setImporting(true);
        const res = await importTelegramAdsCsvAction({
            projectId,
            csv: importCsv,
            mode: importMode,
        });
        setImporting(false);
        if (res.success) {
            toast({ title: 'Imported', description: res.message ?? 'Done.' });
            setImportOpen(false);
            setImportCsv('');
            void reload();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Import failed',
                description: res.error ?? 'Could not parse CSV.',
                variant: 'destructive',
            });
        }
    }

    async function runExport() {
        if (!projectId) return;
        const csv = await exportTelegramAdsCsvAction(projectId);
        if (!csv) {
            toast({
                title: 'Export failed',
                description: 'Could not generate CSV.',
                variant: 'destructive',
            });
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telegram-ads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'CSV downloaded.' });
    }

    async function openUtm(row: CampaignRow) {
        setUtmRow(row);
        setUtmResult(null);
        setUtmCopy(false);
        setUtmOpen(true);
        if (!projectId) return;
        if (!row.landingUrl) return;
        setUtmLoading(true);
        const res = await buildTelegramAdsUtmAction({
            projectId,
            campaignId: row._id,
            landingUrl: row.landingUrl,
            campaign: row.name,
        });
        setUtmLoading(false);
        if (res.success) {
            setUtmResult({ shortUrl: res.shortUrl, longUrl: res.longUrl });
        } else {
            toast({
                title: 'UTM failed',
                description: res.error ?? 'Could not build link.',
                variant: 'destructive',
            });
        }
    }

    async function copyUtm() {
        if (!utmResult) return;
        try {
            await navigator.clipboard.writeText(utmResult.shortUrl);
            setUtmCopy(true);
            setTimeout(() => setUtmCopy(false), 1800);
        } catch {
            /* ignore */
        }
    }

    const rows = data?.campaigns ?? [];
    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
    const someSelected = rows.some((r) => selected.has(r._id));

    function toggleAll(v: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const r of rows) {
                if (v) next.add(r._id);
                else next.delete(r._id);
            }
            return next;
        });
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${ACCENT} 0%, #007DBB 100%)`,
                        boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                    }}
                >
                    <Megaphone className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-zoru-ink-subtle">
                        Telegram
                    </p>
                    <h1 className="mt-0.5 text-[22px] leading-tight text-zoru-ink">
                        Telegram Ads
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Track campaigns from ads.telegram.org in your own database — record budgets,
                        impressions, clicks, generate UTM links, and import/export performance via CSV.
                    </p>
                </div>
                <div className="flex gap-2">
                    <ZoruButton variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                        <Upload className="h-3.5 w-3.5" />
                        Import CSV
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" onClick={runExport}>
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={openCreate} disabled={!projectId}>
                        <Plus className="h-3.5 w-3.5" />
                        New campaign
                    </ZoruButton>
                </div>
            </div>

            {!projectId ? (
                <ZoruCard className="p-6">
                    <div className="flex items-center gap-2 text-zoru-ink-muted">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Select a project to view Telegram ad campaigns.</span>
                    </div>
                </ZoruCard>
            ) : null}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total spend"
                    value={analytics ? fmtCurrencyCents(analytics.totalSpendCents) : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Impressions"
                    value={analytics ? fmtNumber(analytics.totalImpressions) : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Clicks"
                    value={analytics ? fmtNumber(analytics.totalClicks) : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="CTR"
                    value={analytics ? `${analytics.ctr.toFixed(2)}%` : '—'}
                    loading={analyticsLoading}
                />
            </div>

            {/* Chart */}
            <ZoruCard className="p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[14px] text-zoru-ink">Performance over time</h2>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Impressions / clicks (bars) and spend (line)
                        </p>
                    </div>
                </div>
                {analyticsLoading ? (
                    <ZoruSkeleton className="h-[280px] w-full" />
                ) : analytics && analytics.byDay.length > 0 ? (
                    <ZoruChartContainer height={280}>
                        <ComposedChart data={analytics.byDay} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke="hsl(var(--zoru-line))" strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                            <RechartsTooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar
                                yAxisId="left"
                                dataKey="impressions"
                                name="Impressions"
                                fill={ACCENT}
                                fillOpacity={0.4}
                            />
                            <Bar
                                yAxisId="left"
                                dataKey="clicks"
                                name="Clicks"
                                fill={ACCENT}
                                fillOpacity={0.85}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="spendCents"
                                name="Spend (¢)"
                                stroke="hsl(var(--zoru-ink))"
                                strokeWidth={1.5}
                                dot={false}
                            />
                        </ComposedChart>
                    </ZoruChartContainer>
                ) : (
                    <div className="flex h-[200px] items-center justify-center text-sm text-zoru-ink-muted">
                        No data in the selected range.
                    </div>
                )}
            </ZoruCard>

            {/* Filter bar */}
            <ZoruCard className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-subtle" />
                        <ZoruInput
                            placeholder="Search name, notes, platform ID"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="min-w-[150px]">
                        <ZoruSelect value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="min-w-[260px]">
                        <ZoruDateRangePicker
                            value={range.from ? { from: range.from, to: range.to } : undefined}
                            onChange={(r) => setRange({ from: r?.from, to: r?.to })}
                        />
                    </div>
                    {selected.size > 0 ? (
                        <ZoruButton variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete {selected.size}
                        </ZoruButton>
                    ) : null}
                </div>
            </ZoruCard>

            {/* Table */}
            <ZoruCard className="overflow-hidden">
                {loading ? (
                    <div className="flex flex-col gap-2 p-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <ZoruSkeleton key={i} className="h-9 w-full" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-zoru-danger-ink">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                ) : rows.length === 0 ? (
                    <ZoruEmptyState
                        title="No campaigns yet"
                        description="Track Telegram Ads campaigns by adding them here or importing a CSV from ads.telegram.org."
                        icon={<Megaphone className="h-5 w-5" />}
                        action={
                            <ZoruButton size="sm" onClick={openCreate} disabled={!projectId}>
                                <Plus className="h-3.5 w-3.5" />
                                New campaign
                            </ZoruButton>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-zoru-line bg-zoru-surface-2 text-left text-[12px] uppercase tracking-wide text-zoru-ink-subtle">
                                <tr>
                                    <th className="w-10 p-3">
                                        <ZoruCheckbox
                                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                            onCheckedChange={(v) => toggleAll(!!v)}
                                        />
                                    </th>
                                    <th className="p-3 font-medium">Name</th>
                                    <th className="p-3 font-medium">Status</th>
                                    <th className="p-3 font-medium">Platform ID</th>
                                    <th className="p-3 font-medium text-right">Budget</th>
                                    <th className="p-3 font-medium text-right">Impressions</th>
                                    <th className="p-3 font-medium text-right">Clicks</th>
                                    <th className="p-3 font-medium text-right">CTR</th>
                                    <th className="p-3 font-medium">Updated</th>
                                    <th className="p-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const ctr = pctCtr(row.impressions, row.clicks);
                                    const checked = selected.has(row._id);
                                    return (
                                        <tr
                                            key={row._id}
                                            className="group border-b border-zoru-line/60 last:border-b-0 hover:bg-zoru-surface-2/40"
                                        >
                                            <td className="p-3">
                                                <ZoruCheckbox
                                                    checked={checked}
                                                    onCheckedChange={(v) =>
                                                        setSelected((prev) => {
                                                            const next = new Set(prev);
                                                            if (v) next.add(row._id);
                                                            else next.delete(row._id);
                                                            return next;
                                                        })
                                                    }
                                                />
                                            </td>
                                            <td className="p-3 text-zoru-ink">
                                                <div className="font-medium">{row.name}</div>
                                                {row.landingUrl ? (
                                                    <div className="truncate text-[12px] text-zoru-ink-muted max-w-[260px]">
                                                        {row.landingUrl}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="p-3">
                                                <ZoruBadge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                                                    {row.status}
                                                </ZoruBadge>
                                            </td>
                                            <td className="p-3 font-mono text-[12px] text-zoru-ink-muted">
                                                {row.platformId || '—'}
                                            </td>
                                            <td className="p-3 text-right">
                                                {fmtCurrencyCents(row.budgetCents)}
                                            </td>
                                            <td className="p-3 text-right">
                                                {fmtNumber(row.impressions)}
                                            </td>
                                            <td className="p-3 text-right">{fmtNumber(row.clicks)}</td>
                                            <td className="p-3 text-right">{ctr.toFixed(2)}%</td>
                                            <td className="p-3 text-zoru-ink-muted">
                                                {fmtDate(row.updatedAt)}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openUtm(row)}
                                                        title="UTM link"
                                                    >
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => openEdit(row)}
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setDeleteRow(row)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {data && rows.length > 0 ? (
                    <div className="flex items-center justify-between border-t border-zoru-line p-3 text-[12px] text-zoru-ink-muted">
                        <span>
                            {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of{' '}
                            {data.total}
                        </span>
                        <div className="flex items-center gap-1">
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Prev
                            </ZoruButton>
                            <span className="px-2">
                                Page {page} / {totalPages}
                            </span>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                disabled={!data.hasMore}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5" />
                            </ZoruButton>
                        </div>
                    </div>
                ) : null}
            </ZoruCard>

            {/* Editor drawer */}
            <ZoruDrawer open={editorOpen} onOpenChange={setEditorOpen}>
                <ZoruDrawerContent>
                    <ZoruDrawerHeader>
                        <ZoruDrawerTitle>
                            {editorForm.campaignId ? 'Edit campaign' : 'New campaign'}
                        </ZoruDrawerTitle>
                        <ZoruDrawerDescription>
                            Local tracking record for a Telegram Ads campaign.
                        </ZoruDrawerDescription>
                    </ZoruDrawerHeader>
                    <div className="grid gap-3 px-6 pb-4 sm:grid-cols-2">
                        <Field label="Name">
                            <ZoruInput
                                value={editorForm.name}
                                onChange={(e) =>
                                    setEditorForm((f) => ({ ...f, name: e.target.value }))
                                }
                                placeholder="Launch promo, May 2026"
                            />
                        </Field>
                        <Field label="Status">
                            <ZoruSelect
                                value={editorForm.status}
                                onValueChange={(v) => setEditorForm((f) => ({ ...f, status: v }))}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </Field>
                        <Field label="Platform ID">
                            <ZoruInput
                                value={editorForm.platformId}
                                onChange={(e) =>
                                    setEditorForm((f) => ({ ...f, platformId: e.target.value }))
                                }
                                placeholder="ad_xxx from ads.telegram.org"
                            />
                        </Field>
                        <Field label="Budget (USD)">
                            <ZoruInput
                                inputMode="decimal"
                                value={editorForm.budgetDollars}
                                onChange={(e) =>
                                    setEditorForm((f) => ({ ...f, budgetDollars: e.target.value }))
                                }
                                placeholder="100.00"
                            />
                        </Field>
                        <Field label="Impressions">
                            <ZoruInput
                                inputMode="numeric"
                                value={editorForm.impressions}
                                onChange={(e) =>
                                    setEditorForm((f) => ({ ...f, impressions: e.target.value }))
                                }
                            />
                        </Field>
                        <Field label="Clicks">
                            <ZoruInput
                                inputMode="numeric"
                                value={editorForm.clicks}
                                onChange={(e) =>
                                    setEditorForm((f) => ({ ...f, clicks: e.target.value }))
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Landing URL">
                                <ZoruInput
                                    type="url"
                                    value={editorForm.landingUrl}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({ ...f, landingUrl: e.target.value }))
                                    }
                                    placeholder="https://your-domain.com/lp"
                                />
                            </Field>
                        </div>
                        <div className="sm:col-span-2">
                            <Field label="Notes">
                                <ZoruTextarea
                                    rows={3}
                                    value={editorForm.notes}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({ ...f, notes: e.target.value }))
                                    }
                                    placeholder="Audience, targeting context, learnings…"
                                />
                            </Field>
                        </div>
                        {editorErr ? (
                            <p className="text-[12.5px] text-zoru-danger-ink sm:col-span-2">
                                {editorErr}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex justify-end gap-2 px-6 pb-6">
                        <ZoruButton variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton size="sm" onClick={saveEditor} disabled={savingEditor}>
                            {savingEditor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Save
                        </ZoruButton>
                    </div>
                </ZoruDrawerContent>
            </ZoruDrawer>

            {/* Import dialog */}
            <ZoruDialog open={importOpen} onOpenChange={setImportOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Import campaigns from CSV</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Headers must include <code>name</code> and may also use{' '}
                            <code>impressions</code>, <code>clicks</code>, <code>budget_cents</code>,{' '}
                            <code>status</code>, <code>platform_id</code>, <code>landing_url</code>.
                            Matched on <code>platform_id</code> if present, otherwise on{' '}
                            <code>name</code>.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-3">
                        <div className="text-[12px] text-zoru-ink-muted">
                            Sample:
                            <pre className="mt-1 overflow-x-auto rounded-md border border-zoru-line bg-zoru-surface-2 p-2 font-mono text-[11.5px]">
{`name,impressions,clicks,budget_cents,status,platform_id,landing_url
Launch promo,12000,420,5000,active,ad_abc,https://you/lp`}
                            </pre>
                        </div>
                        <div>
                            <ZoruSelect
                                value={importMode}
                                onValueChange={(v) => setImportMode(v as 'append' | 'replace_stats')}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="append">Append (add to counts)</ZoruSelectItem>
                                    <ZoruSelectItem value="replace_stats">
                                        Replace stats
                                    </ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <ZoruTextarea
                            value={importCsv}
                            onChange={(e) => setImportCsv(e.target.value)}
                            rows={10}
                            placeholder="Paste CSV here…"
                            className="font-mono text-[12px]"
                        />
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" size="sm" onClick={() => setImportOpen(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton size="sm" onClick={runImport} disabled={importing}>
                            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Import
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* UTM dialog */}
            <ZoruDialog open={utmOpen} onOpenChange={setUtmOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>UTM link</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {utmRow ? `For "${utmRow.name}"` : null}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    {!utmRow?.landingUrl ? (
                        <p className="text-[13px] text-zoru-danger-ink">
                            This campaign has no landing URL — add one to generate a UTM link.
                        </p>
                    ) : utmLoading ? (
                        <ZoruSkeleton className="h-12 w-full" />
                    ) : utmResult ? (
                        <div className="space-y-3">
                            <code className="block break-all rounded-md border border-zoru-line bg-zoru-surface-2 p-2 font-mono text-[12px]">
                                {utmResult.shortUrl}
                            </code>
                            {utmResult.longUrl !== utmResult.shortUrl ? (
                                <details className="text-[12px] text-zoru-ink-muted">
                                    <summary className="cursor-pointer select-none">Long URL</summary>
                                    <code className="mt-1 block break-all rounded-md border border-zoru-line bg-zoru-surface-2 p-2 font-mono text-[12px]">
                                        {utmResult.longUrl}
                                    </code>
                                </details>
                            ) : null}
                        </div>
                    ) : null}
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" size="sm" onClick={() => setUtmOpen(false)}>
                            Close
                        </ZoruButton>
                        <ZoruButton size="sm" onClick={copyUtm} disabled={!utmResult}>
                            <Copy className="h-3.5 w-3.5" />
                            {utmCopy ? 'Copied' : 'Copy'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Single-row delete confirm */}
            <ZoruDialog open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete campaign?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {deleteRow ? `"${deleteRow.name}" will be permanently removed.` : ''}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" size="sm" onClick={() => setDeleteRow(null)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton size="sm" onClick={confirmDelete}>
                            Delete
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Bulk delete confirm */}
            <ZoruDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete {selected.size} campaigns?</ZoruDialogTitle>
                        <ZoruDialogDescription>This cannot be undone.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton size="sm" onClick={confirmBulkDelete}>
                            Delete
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}

function KpiCard({
    label,
    value,
    loading,
}: {
    label: string;
    value: string;
    loading: boolean;
}) {
    return (
        <ZoruCard>
            <ZoruCardContent className="flex flex-col gap-1 pt-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                    {label}
                </p>
                {loading ? (
                    <ZoruSkeleton className="h-7 w-24" />
                ) : (
                    <p className="text-2xl font-semibold tracking-tight text-zoru-ink">{value}</p>
                )}
            </ZoruCardContent>
        </ZoruCard>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <TelegramProjectGate />
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                {label}
            </span>
            {children}
        </label>
    );
}
