'use client';

import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
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
  ZoruAlertDialog,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  Checkbox,
} from '@/components/sabcrm/20ui/compat';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Heart,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  Unlink,
  X,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import { useToast } from '@/hooks/use-toast';
import {
    disconnectTelegramBot,
    refreshTelegramWebhookInfo,
    rotateTelegramWebhookSecret,
} from '@/app/actions/telegram.actions';
import {
    listTelegramBotsAction,
    runTelegramBotHealthAction,
    bulkDisconnectTelegramBotsAction,
    exportTelegramBotsCsvAction,
} from '@/app/actions/telegram-extra.actions';
import type {
    BotRow,
    BotStatus,
    ListBotsResp,
} from '@/lib/rust-client/telegram-bots';
import { BotDetailDrawer } from './bot-detail-drawer';

type StatusFilter = 'all' | BotStatus;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'disconnected', label: 'Disconnected' },
    { value: 'error', label: 'Error' },
];

const PAGE_SIZE = 25;

function StatusBadge({ status }: { status: BotStatus }) {
    if (status === 'active') {
        return (
            <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
            </Badge>
        );
    }
    if (status === 'error') {
        return (
            <Badge variant="danger">
                <AlertTriangle className="h-3 w-3" aria-hidden /> Error
            </Badge>
        );
    }
    return (
        <Badge variant="ghost">
            <Unlink className="h-3 w-3" aria-hidden /> Disconnected
        </Badge>
    );
}

function formatRelative(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    return d.toLocaleDateString();
}

function CopyableText({ value }: { value: string }) {
    const [copied, setCopied] = React.useState(false);
    const handle = React.useCallback(async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard might be blocked */
        }
    }, [value]);
    return (
        <button
            type="button"
            onClick={handle}
            className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-zoru-line bg-zoru-surface-2 px-2 py-1 font-mono text-[11px] text-zoru-ink-muted hover:border-zoru-line-strong"
            aria-label={copied ? 'Copied' : 'Copy webhook URL'}
        >
            <span className="truncate">{value}</span>
            {copied ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-zoru-ink" aria-hidden />
            ) : (
                <Copy className="h-3 w-3 shrink-0" aria-hidden />
            )}
        </button>
    );
}

function BotAvatar({ bot }: { bot: BotRow }) {
    const initial =
        (bot.name || bot.username || '?').trim().charAt(0).toUpperCase() || '?';
    return (
        <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{
                background:
                    'linear-gradient(135deg, #229ED9 0%, #1A7FA8 100%)',
            }}
            aria-hidden
        >
            {initial}
        </div>
    );
}

function RowSkeleton() {
    return (
        <ZoruTableRow>
            {Array.from({ length: 8 }).map((_, i) => (
                <ZoruTableCell key={i}>
                    <Skeleton className="h-4 w-full" />
                </ZoruTableCell>
            ))}
        </ZoruTableRow>
    );
}

export default function TelegramBotsPage() {
    const { activeProject } = useProject();
    const { toast } = useToast();
    const projectId = activeProject?._id?.toString() ?? null;

    const [data, setData] = React.useState<ListBotsResp | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [status, setStatus] = React.useState<StatusFilter>('all');
    const [page, setPage] = React.useState(1);

    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkOpen, setBulkOpen] = React.useState(false);
    const [bulkBusy, setBulkBusy] = React.useState(false);
    const [rowBusy, setRowBusy] = React.useState<Record<string, boolean>>({});
    const [exporting, setExporting] = React.useState(false);

    const [detailBotId, setDetailBotId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
        return () => window.clearTimeout(t);
    }, [search]);

    React.useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, projectId]);

    const fetchList = React.useCallback(async () => {
        if (!projectId) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        const res = await listTelegramBotsAction({
            projectId,
            status: status === 'all' ? undefined : status,
            q: debouncedSearch || undefined,
            page,
            pageSize: PAGE_SIZE,
        });
        if (res.error) {
            setError(res.error);
            setData({ bots: [], total: 0, page, pageSize: PAGE_SIZE });
        } else {
            setData(res);
        }
        setLoading(false);
    }, [projectId, status, debouncedSearch, page]);

    React.useEffect(() => {
        fetchList();
    }, [fetchList]);

    const rows = data?.bots ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const kpis = React.useMemo(() => {
        const all = rows;
        const active = all.filter((b) => b.status === 'active').length;
        const errors = all.filter((b) => b.status === 'error').length;
        const latencies = all
            .map((b) => b.latencyMs)
            .filter((n): n is number => typeof n === 'number' && n >= 0);
        const avgLatency = latencies.length
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null;
        return { total, active, errors, avgLatency };
    }, [rows, total]);

    const allSelectedOnPage = rows.length > 0 && rows.every((r) => selected.has(r._id));
    const someSelected = rows.some((r) => selected.has(r._id));

    function toggleSelectAll() {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelectedOnPage) {
                for (const r of rows) next.delete(r._id);
            } else {
                for (const r of rows) next.add(r._id);
            }
            return next;
        });
    }

    function toggleSelectRow(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function setBusy(id: string, busy: boolean) {
        setRowBusy((p) => ({ ...p, [id]: busy }));
    }

    async function handleHealth(bot: BotRow) {
        await setBusy(bot._id, true);
        const res = await runTelegramBotHealthAction(bot._id);
        await setBusy(bot._id, false);
        if (res.success) {
            toast({
                title: 'Bot is healthy',
                description: `Latency ${res.latencyMs ?? '—'}ms`,
            });
            fetchList();
        } else {
            toast({
                title: 'Health check failed',
                description: res.error ?? 'Telegram did not respond.',
                variant: 'destructive',
            });
        }
    }

    async function handleRefreshWebhook(bot: BotRow) {
        await setBusy(bot._id, true);
        const res = await refreshTelegramWebhookInfo(bot._id);
        await setBusy(bot._id, false);
        if (res.success) {
            toast({ title: 'Webhook refreshed' });
            fetchList();
        } else {
            toast({
                title: 'Refresh failed',
                description: res.error ?? 'Could not reach Telegram.',
                variant: 'destructive',
            });
        }
    }

    async function handleRotate(bot: BotRow) {
        await setBusy(bot._id, true);
        const res = await rotateTelegramWebhookSecret(bot._id);
        await setBusy(bot._id, false);
        if (res.success) {
            toast({ title: 'Webhook secret rotated' });
            fetchList();
        } else {
            toast({
                title: 'Rotate failed',
                description: res.error ?? 'Could not rotate secret.',
                variant: 'destructive',
            });
        }
    }

    async function handleDisconnect(bot: BotRow) {
        await setBusy(bot._id, true);
        const res = await disconnectTelegramBot(bot._id);
        await setBusy(bot._id, false);
        if (res.success) {
            toast({ title: 'Bot disconnected' });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(bot._id);
                return next;
            });
            fetchList();
        } else {
            toast({
                title: 'Disconnect failed',
                description: res.error ?? 'Could not disconnect bot.',
                variant: 'destructive',
            });
        }
    }

    async function handleBulkDisconnect() {
        if (!projectId) return;
        const ids = Array.from(selected);
        if (!ids.length) return;
        setBulkBusy(true);
        const res = await bulkDisconnectTelegramBotsAction(projectId, ids);
        setBulkBusy(false);
        setBulkOpen(false);
        if (res.error) {
            toast({
                title: 'Bulk disconnect failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({
            title: `Disconnected ${res.disconnected}`,
            description:
                res.failed > 0 ? `${res.failed} could not be disconnected.` : undefined,
        });
        setSelected(new Set());
        fetchList();
    }

    async function handleExport() {
        if (!projectId) return;
        setExporting(true);
        try {
            const csv = await exportTelegramBotsCsvAction(projectId);
            if (!csv) {
                toast({
                    title: 'Export failed',
                    description: 'No CSV returned.',
                    variant: 'destructive',
                });
                return;
            }
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `telegram-bots-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            toast({
                title: 'Export failed',
                description: String(e),
                variant: 'destructive',
            });
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <TelegramProjectGate />
            {/* Header */}
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background:
                            'linear-gradient(135deg, #37BBFE 0%, #229ED9 100%)',
                        boxShadow: '0 10px 28px rgba(34, 158, 217, 0.25)',
                    }}
                >
                    <Bot className="h-6 w-6 text-white" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="flex-1">
                    <h1 className="text-[22px] leading-tight text-zoru-ink">
                        Telegram Bots
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Manage Telegram bots — health, commands, profile, menu button, and
                        webhook secrets — all in one place.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={!projectId || exporting || rows.length === 0}
                    >
                        {exporting ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : null}
                        Export CSV
                    </Button>
                    <Link href="/dashboard/telegram/connections">
                        <Button size="sm">
                            <Plus className="h-3 w-3" aria-hidden /> Connect a bot
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                    label="Total bots"
                    value={total}
                    icon={<Bot className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                    label="Active"
                    value={kpis.active}
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                    label="Errors"
                    value={kpis.errors}
                    icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                    label="Avg latency"
                    value={kpis.avgLatency !== null ? `${kpis.avgLatency} ms` : '—'}
                    icon={<Activity className="h-4 w-4" aria-hidden />}
                />
            </div>

            {/* Filter bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted"
                            aria-hidden
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or @username"
                            className="pl-8"
                            aria-label="Search bots"
                        />
                    </div>
                    <Select
                        value={status}
                        onValueChange={(v) => setStatus(v as StatusFilter)}
                    >
                        <ZoruSelectTrigger className="w-[160px]">
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUS_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                {someSelected ? (
                    <div className="flex items-center gap-2">
                        <span className="text-[12.5px] text-zoru-ink-muted">
                            {selected.size} selected
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelected(new Set())}
                        >
                            <X className="h-3 w-3" aria-hidden /> Clear
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setBulkOpen(true)}
                        >
                            <Unlink className="h-3 w-3" aria-hidden /> Disconnect selected
                        </Button>
                    </div>
                ) : null}
            </div>

            {/* Table */}
            <Card className="overflow-hidden p-0">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead className="w-10">
                                <Checkbox
                                    checked={allSelectedOnPage}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all on page"
                                />
                            </ZoruTableHead>
                            <ZoruTableHead>Bot</ZoruTableHead>
                            <ZoruTableHead>Username</ZoruTableHead>
                            <ZoruTableHead>Status</ZoruTableHead>
                            <ZoruTableHead>Webhook</ZoruTableHead>
                            <ZoruTableHead>Last seen</ZoruTableHead>
                            <ZoruTableHead className="text-right">Latency</ZoruTableHead>
                            <ZoruTableHead className="w-10" />
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {loading ? (
                            <>
                                <RowSkeleton />
                                <RowSkeleton />
                                <RowSkeleton />
                            </>
                        ) : rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={8} className="p-0">
                                    <EmptyState
                                        icon={<Bot className="h-5 w-5" aria-hidden />}
                                        title={
                                            error
                                                ? 'Could not load bots'
                                                : debouncedSearch || status !== 'all'
                                                  ? 'No bots match your filters'
                                                  : 'No bots yet'
                                        }
                                        description={
                                            error
                                                ? error
                                                : debouncedSearch || status !== 'all'
                                                  ? 'Try a different search term or status.'
                                                  : 'Connect a bot to start managing it from SabNode.'
                                        }
                                        action={
                                            !error && !debouncedSearch && status === 'all' ? (
                                                <Link href="/dashboard/telegram/connections">
                                                    <Button size="sm">
                                                        <Plus className="h-3 w-3" aria-hidden /> Connect a
                                                        bot
                                                    </Button>
                                                </Link>
                                            ) : null
                                        }
                                        className="m-6 border-0"
                                    />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((bot) => {
                                const busy = !!rowBusy[bot._id];
                                return (
                                    <ZoruTableRow key={bot._id}>
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={selected.has(bot._id)}
                                                onCheckedChange={() => toggleSelectRow(bot._id)}
                                                aria-label={`Select ${bot.name || bot.username}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <button
                                                type="button"
                                                onClick={() => setDetailBotId(bot._id)}
                                                className="flex items-center gap-3 text-left"
                                            >
                                                <BotAvatar bot={bot} />
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-medium text-zoru-ink">
                                                        {bot.name || bot.username || 'Untitled bot'}
                                                    </span>
                                                    <span className="text-[11.5px] text-zoru-ink-muted">
                                                        #{bot.botId}
                                                    </span>
                                                </div>
                                            </button>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {bot.username ? (
                                                <a
                                                    href={`https://t.me/${bot.username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink hover:underline"
                                                >
                                                    @{bot.username}
                                                    <ExternalLink className="h-3 w-3" aria-hidden />
                                                </a>
                                            ) : (
                                                <span className="text-[12.5px] text-zoru-ink-muted">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusBadge status={bot.status} />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {bot.webhookUrl ? (
                                                <CopyableText value={bot.webhookUrl} />
                                            ) : (
                                                <span className="text-[12.5px] text-zoru-ink-muted">
                                                    Not registered
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {formatRelative(bot.lastSeenAt)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink-muted">
                                            {typeof bot.latencyMs === 'number'
                                                ? `${bot.latencyMs} ms`
                                                : '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <DropdownMenu>
                                                <ZoruDropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="Bot actions"
                                                        disabled={busy}
                                                    >
                                                        {busy ? (
                                                            <Loader2
                                                                className="h-3.5 w-3.5 animate-spin"
                                                                aria-hidden
                                                            />
                                                        ) : (
                                                            <MoreHorizontal
                                                                className="h-3.5 w-3.5"
                                                                aria-hidden
                                                            />
                                                        )}
                                                    </Button>
                                                </ZoruDropdownMenuTrigger>
                                                <ZoruDropdownMenuContent align="end">
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() => setDetailBotId(bot._id)}
                                                    >
                                                        <ExternalLink
                                                            className="h-3 w-3"
                                                            aria-hidden
                                                        />
                                                        Open detail
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() => handleHealth(bot)}
                                                    >
                                                        <Heart className="h-3 w-3" aria-hidden />
                                                        Health check
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() => handleRefreshWebhook(bot)}
                                                    >
                                                        <RefreshCw className="h-3 w-3" aria-hidden />
                                                        Refresh webhook
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() => handleRotate(bot)}
                                                    >
                                                        <RotateCw className="h-3 w-3" aria-hidden />
                                                        Rotate secret
                                                    </ZoruDropdownMenuItem>
                                                    <ZoruDropdownMenuSeparator />
                                                    <ZoruDropdownMenuItem
                                                        onSelect={() => handleDisconnect(bot)}
                                                        className="text-zoru-danger-ink focus:bg-zoru-danger-bg"
                                                    >
                                                        <Trash2 className="h-3 w-3" aria-hidden />
                                                        Disconnect
                                                    </ZoruDropdownMenuItem>
                                                </ZoruDropdownMenuContent>
                                            </DropdownMenu>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                );
                            })
                        )}
                    </ZoruTableBody>
                </Table>
                {totalPages > 1 ? (
                    <div className="flex items-center justify-between border-t border-zoru-line px-4 py-3 text-[12.5px] text-zoru-ink-muted">
                        <span>
                            Page {page} of {totalPages} · {total} bot{total === 1 ? '' : 's'}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Card>

            {/* Bulk-disconnect confirm */}
            <ZoruAlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Disconnect {selected.size} bot{selected.size === 1 ? '' : 's'}?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This removes each bot from SabNode and deletes its webhook on
                            Telegram. The Bot Tokens themselves stay valid — you can
                            re-connect at any time.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel disabled={bulkBusy}>
                            Cancel
                        </ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleBulkDisconnect}
                            disabled={bulkBusy}
                        >
                            {bulkBusy ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : null}
                            Disconnect
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            {/* Detail drawer */}
            <BotDetailDrawer
                botId={detailBotId}
                projectId={projectId}
                onOpenChange={(open) => {
                    if (!open) setDetailBotId(null);
                }}
                onMutated={fetchList}
            />
        </div>
    );
}
