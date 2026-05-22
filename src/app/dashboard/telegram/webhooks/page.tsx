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
  ZoruCardContent,
  ZoruChartContainer,
  Checkbox,
  ZoruDateRangePicker,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  EmptyState,
  Input,
  Label,
  PageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  Switch,
  ZORU_CHART_PALETTE,
  useZoruToast,
} from '@/components/zoruui';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
  } from 'lucide-react';
import {
    Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    deleteTelegramWebhookDlqAction,
    deleteTelegramWebhookSubscriptionAction,
    getTelegramWebhookAnalyticsAction,
    getTelegramWebhookDeliveryAction,
    listTelegramWebhookDeliveriesAction,
    listTelegramWebhookDlqAction,
    listTelegramWebhookSubscriptionsAction,
    putTelegramWebhookSubscriptionAction,
    replayTelegramWebhookDeliveryAction,
    resolveTelegramWebhookDlqAction,
    retryTelegramWebhookDlqAction,
    rotateTelegramWebhookSecretAction,
    testTelegramWebhookSubscriptionAction,
} from '@/app/actions/telegram-webhooks.actions';
import type {
    AnalyticsResp,
    ListDeliveriesResp,
    ListDlqResp,
    ListSubscriptionsResp,
    WebhookDeliveryRow,
    WebhookDlqRow,
    WebhookSubscriptionRow,
} from '@/lib/rust-client/telegram-webhooks';
import { TELEGRAM_ALLOWED_UPDATES } from '@/lib/rust-client/telegram-webhooks-shared';

const ACCENT = '#229ED9';

const SECTIONS = ['subscriptions', 'deliveries', 'dlq', 'analytics'] as const;
type Section = (typeof SECTIONS)[number];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'ghost' | 'info'> = {
    received: 'info',
    processed: 'success',
    failed: 'destructive',
    pending: 'warning',
    retrying: 'warning',
    failed_permanent: 'destructive',
    resolved: 'success',
};

const EVENT_TYPE_OPTIONS = [
    { value: 'all', label: 'All events' },
    ...TELEGRAM_ALLOWED_UPDATES.map((v) => ({ value: v, label: v })),
];

function fmtDate(iso?: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function fmtNumber(n: number): string {
    return n.toLocaleString();
}

function maskSecret(s?: string): string {
    if (!s) return '—';
    if (s.length <= 6) return '••••';
    return `${s.slice(0, 3)}…${s.slice(-3)}`;
}

// ===========================================================================
//  Page
// ===========================================================================

export default function TelegramWebhooksPage() {
    const { activeProjectId } = useProject();
    const { toast } = useZoruToast();
    const [section, setSection] = React.useState<Section>('subscriptions');

    // ---------- Subscriptions state ----------
    const [subs, setSubs] = React.useState<WebhookSubscriptionRow[]>([]);
    const [subsLoading, setSubsLoading] = React.useState(false);
    const [subsError, setSubsError] = React.useState<string | null>(null);
    const [editing, setEditing] = React.useState<WebhookSubscriptionRow | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState<WebhookSubscriptionRow | null>(null);
    const [confirmRotateAll, setConfirmRotateAll] = React.useState(false);

    // ---------- Deliveries state ----------
    const [deliveries, setDeliveries] = React.useState<WebhookDeliveryRow[]>([]);
    const [delivLoading, setDelivLoading] = React.useState(false);
    const [delivCursor, setDelivCursor] = React.useState<string | null>(null);
    const [delivHasMore, setDelivHasMore] = React.useState(false);
    const [delivBot, setDelivBot] = React.useState<string>('all');
    const [delivEvent, setDelivEvent] = React.useState<string>('all');
    const [delivStatus, setDelivStatus] = React.useState<string>('all');
    const [delivSearch, setDelivSearch] = React.useState('');
    const [delivRange, setDelivRange] = React.useState<{ from?: Date; to?: Date }>({});
    const [drawerDelivery, setDrawerDelivery] = React.useState<WebhookDeliveryRow | null>(null);

    // ---------- DLQ state ----------
    const [dlq, setDlq] = React.useState<WebhookDlqRow[]>([]);
    const [dlqLoading, setDlqLoading] = React.useState(false);
    const [dlqStatus, setDlqStatus] = React.useState<string>('all');
    const [dlqBot, setDlqBot] = React.useState<string>('all');
    const [confirmDlqDelete, setConfirmDlqDelete] = React.useState<WebhookDlqRow | null>(null);

    // ---------- Analytics state ----------
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = React.useState(false);

    const botOptions = React.useMemo(() => {
        const seen = new Map<string, string>();
        for (const s of subs) {
            seen.set(s.botId, s.botUsername ?? s.botId);
        }
        return [
            { value: 'all', label: 'All bots' },
            ...Array.from(seen).map(([v, l]) => ({ value: v, label: l })),
        ];
    }, [subs]);

    // -- Loaders --------------------------------------------------------

    const loadSubs = React.useCallback(async () => {
        if (!activeProjectId) return;
        setSubsLoading(true);
        try {
            const res: ListSubscriptionsResp =
                await listTelegramWebhookSubscriptionsAction(activeProjectId);
            setSubs(res.subscriptions ?? []);
            setSubsError(res.error ?? null);
        } finally {
            setSubsLoading(false);
        }
    }, [activeProjectId]);

    const loadDeliveries = React.useCallback(
        async (append: boolean) => {
            if (!activeProjectId) return;
            setDelivLoading(true);
            try {
                const res: ListDeliveriesResp = await listTelegramWebhookDeliveriesAction({
                    projectId: activeProjectId,
                    botId: delivBot !== 'all' ? delivBot : undefined,
                    eventType: delivEvent !== 'all' ? delivEvent : undefined,
                    status:
                        delivStatus !== 'all'
                            ? (delivStatus as 'received' | 'processed' | 'failed')
                            : undefined,
                    search: delivSearch || undefined,
                    from: delivRange.from?.toISOString(),
                    to: delivRange.to?.toISOString(),
                    cursor: append ? delivCursor ?? undefined : undefined,
                    limit: 50,
                });
                setDeliveries((prev) =>
                    append ? [...prev, ...(res.deliveries ?? [])] : res.deliveries ?? [],
                );
                setDelivCursor(res.nextCursor);
                setDelivHasMore(Boolean(res.nextCursor));
            } finally {
                setDelivLoading(false);
            }
        },
        [activeProjectId, delivBot, delivEvent, delivStatus, delivSearch, delivRange, delivCursor],
    );

    const loadDlq = React.useCallback(async () => {
        if (!activeProjectId) return;
        setDlqLoading(true);
        try {
            const res: ListDlqResp = await listTelegramWebhookDlqAction({
                projectId: activeProjectId,
                botId: dlqBot !== 'all' ? dlqBot : undefined,
                status:
                    dlqStatus !== 'all'
                        ? (dlqStatus as 'pending' | 'retrying' | 'failed_permanent' | 'resolved')
                        : undefined,
                limit: 100,
            });
            setDlq(res.items ?? []);
        } finally {
            setDlqLoading(false);
        }
    }, [activeProjectId, dlqBot, dlqStatus]);

    const loadAnalytics = React.useCallback(async () => {
        if (!activeProjectId) return;
        setAnalyticsLoading(true);
        try {
            const now = new Date();
            const from = new Date(now);
            from.setDate(from.getDate() - 7);
            const res = await getTelegramWebhookAnalyticsAction({
                projectId: activeProjectId,
                from: from.toISOString(),
                to: now.toISOString(),
            });
            setAnalytics(res);
        } finally {
            setAnalyticsLoading(false);
        }
    }, [activeProjectId]);

    React.useEffect(() => {
        if (!activeProjectId) return;
        loadSubs();
        loadAnalytics();
    }, [activeProjectId, loadSubs, loadAnalytics]);

    React.useEffect(() => {
        if (section === 'deliveries') void loadDeliveries(false);
        if (section === 'dlq') void loadDlq();
        if (section === 'analytics') void loadAnalytics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section]);

    // -- Subscription actions ------------------------------------------

    async function handleTest(s: WebhookSubscriptionRow) {
        if (!activeProjectId) return;
        const res = await testTelegramWebhookSubscriptionAction(s.botId, activeProjectId);
        if (res.success) {
            toast({
                title: 'Webhook OK',
                description: `Pending updates: ${res.webhookInfo?.pending_update_count ?? 0}`,
            });
            await loadSubs();
        } else {
            toast({
                title: 'Webhook test failed',
                description: res.error ?? 'unknown',
                variant: 'destructive',
            });
        }
    }

    async function handleRotate(s: WebhookSubscriptionRow) {
        if (!activeProjectId) return;
        const res = await rotateTelegramWebhookSecretAction(s.botId, activeProjectId);
        if (res.success) {
            toast({ title: 'Secret rotated' });
            await loadSubs();
        } else {
            toast({ title: 'Rotate failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    async function handleDeleteSub() {
        if (!activeProjectId || !confirmDelete) return;
        const res = await deleteTelegramWebhookSubscriptionAction(confirmDelete.botId, {
            projectId: activeProjectId,
            dropPendingUpdates: false,
        });
        if (res.success) {
            toast({ title: 'Webhook deleted' });
            setConfirmDelete(null);
            await loadSubs();
        } else {
            toast({ title: 'Delete failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    async function handleRotateAll() {
        if (!activeProjectId) return;
        setConfirmRotateAll(false);
        let ok = 0;
        let fail = 0;
        for (const s of subs) {
            const res = await rotateTelegramWebhookSecretAction(s.botId, activeProjectId);
            if (res.success) ok += 1;
            else fail += 1;
        }
        toast({
            title: 'Bulk rotation complete',
            description: `Rotated ${ok}, failed ${fail}.`,
            variant: fail ? 'destructive' : 'default',
        });
        await loadSubs();
    }

    // -- Deliveries actions --------------------------------------------

    async function handleReplay(d: WebhookDeliveryRow) {
        if (!activeProjectId) return;
        const res = await replayTelegramWebhookDeliveryAction(d._id, activeProjectId);
        if (res.success) {
            toast({ title: 'Replayed', description: `New delivery: ${res.deliveryId ?? ''}` });
            await loadDeliveries(false);
        } else {
            toast({ title: 'Replay failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    async function openDeliveryDrawer(d: WebhookDeliveryRow) {
        if (!activeProjectId) return;
        const res = await getTelegramWebhookDeliveryAction(d._id, activeProjectId);
        if (res.delivery) {
            setDrawerDelivery(res.delivery);
        } else if (res.error) {
            toast({ title: 'Failed to load payload', description: res.error, variant: 'destructive' });
        }
    }

    // -- DLQ actions ---------------------------------------------------

    async function handleDlqRetry(d: WebhookDlqRow) {
        if (!activeProjectId) return;
        const res = await retryTelegramWebhookDlqAction(d._id, activeProjectId);
        if (res.success) {
            toast({ title: 'Retry queued' });
            await loadDlq();
        } else {
            toast({ title: 'Retry failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    async function handleDlqResolve(d: WebhookDlqRow) {
        if (!activeProjectId) return;
        const res = await resolveTelegramWebhookDlqAction(d._id, activeProjectId);
        if (res.success) {
            toast({ title: 'Marked resolved' });
            await loadDlq();
        } else {
            toast({ title: 'Failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    async function handleDlqDelete() {
        if (!activeProjectId || !confirmDlqDelete) return;
        const res = await deleteTelegramWebhookDlqAction(confirmDlqDelete._id, activeProjectId);
        if (res.success) {
            toast({ title: 'DLQ item deleted' });
            setConfirmDlqDelete(null);
            await loadDlq();
        } else {
            toast({ title: 'Failed', description: res.error ?? 'unknown', variant: 'destructive' });
        }
    }

    if (!activeProjectId) {
        return (
            <div className="p-6">
                <ZoruEmptyState
                    icon={<Webhook className="h-8 w-8" />}
                    title="Pick a project"
                    description="Telegram webhooks are scoped to a project. Choose one to continue."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageEyebrow style={{ color: ACCENT }}>Telegram</ZoruPageEyebrow>
                    <ZoruPageTitle className="flex items-center gap-2">
                        <Webhook className="h-6 w-6" style={{ color: ACCENT }} />
                        Telegram Webhooks
                    </ZoruPageTitle>
                    <ZoruPageDescription>
                        Subscriptions, delivery log, dead-letter queue, and replay for every bot in
                        this project.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex flex-wrap items-center gap-2">
                    <ZoruButton
                        variant="outline"
                        onClick={() => {
                            loadSubs();
                            loadAnalytics();
                        }}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </ZoruButton>
                    <ZoruButton
                        variant="outline"
                        onClick={() => setConfirmRotateAll(true)}
                        disabled={subs.length === 0}
                    >
                        <ShieldCheck className="mr-2 h-4 w-4" /> Rotate all secrets
                    </ZoruButton>
                </div>
            </ZoruPageHeader>

            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ZoruStatCard
                    label="Deliveries (7 d)"
                    value={analyticsLoading ? '…' : fmtNumber(analytics?.totalReceived ?? 0)}
                    icon={<Inbox className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Failed (7 d)"
                    value={analyticsLoading ? '…' : fmtNumber(analytics?.totalFailed ?? 0)}
                    icon={<XCircle className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="DLQ size"
                    value={analyticsLoading ? '…' : fmtNumber(analytics?.dlqCount ?? 0)}
                    icon={<AlertCircle className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Avg processing ms"
                    value={
                        analyticsLoading
                            ? '…'
                            : Math.round(analytics?.avgProcessingMs ?? 0).toString()
                    }
                    icon={<Settings2 className="h-4 w-4" />}
                />
            </div>

            {/* Segmented control */}
            <div className="flex w-full flex-wrap gap-1 rounded-md border bg-muted/30 p-1">
                {SECTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => setSection(s)}
                        className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition ${
                            section === s
                                ? 'bg-background shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {section === 'subscriptions' && (
                <SubscriptionsSection
                    loading={subsLoading}
                    error={subsError}
                    subs={subs}
                    onEdit={(s) => setEditing(s)}
                    onTest={handleTest}
                    onRotate={handleRotate}
                    onDelete={(s) => setConfirmDelete(s)}
                    onAddNew={() =>
                        setEditing({
                            _id: '',
                            projectId: activeProjectId,
                            botId: '',
                            url: '',
                            allowedUpdates: [...TELEGRAM_ALLOWED_UPDATES.slice(0, 9)],
                            maxConnections: 40,
                            dropPendingUpdates: false,
                            createdAt: '',
                            updatedAt: '',
                        })
                    }
                />
            )}

            {section === 'deliveries' && (
                <DeliveriesSection
                    loading={delivLoading}
                    deliveries={deliveries}
                    hasMore={delivHasMore}
                    botOptions={botOptions}
                    bot={delivBot}
                    event={delivEvent}
                    status={delivStatus}
                    search={delivSearch}
                    range={delivRange}
                    onBot={(v) => setDelivBot(v)}
                    onEvent={(v) => setDelivEvent(v)}
                    onStatus={(v) => setDelivStatus(v)}
                    onSearch={(v) => setDelivSearch(v)}
                    onRange={setDelivRange}
                    onApply={() => loadDeliveries(false)}
                    onMore={() => loadDeliveries(true)}
                    onView={(d) => void openDeliveryDrawer(d)}
                    onReplay={handleReplay}
                />
            )}

            {section === 'dlq' && (
                <DlqSection
                    loading={dlqLoading}
                    items={dlq}
                    botOptions={botOptions}
                    bot={dlqBot}
                    status={dlqStatus}
                    onBot={(v) => setDlqBot(v)}
                    onStatus={(v) => setDlqStatus(v)}
                    onApply={loadDlq}
                    onRetry={handleDlqRetry}
                    onResolve={handleDlqResolve}
                    onDelete={(d) => setConfirmDlqDelete(d)}
                />
            )}

            {section === 'analytics' && (
                <AnalyticsSection loading={analyticsLoading} analytics={analytics} />
            )}

            <SubscriptionDrawer
                open={editing !== null}
                onClose={() => setEditing(null)}
                projectId={activeProjectId}
                subs={subs}
                editing={editing}
                onSaved={async () => {
                    setEditing(null);
                    await loadSubs();
                    toast({ title: 'Webhook saved' });
                }}
                onError={(msg) =>
                    toast({ title: 'Save failed', description: msg, variant: 'destructive' })
                }
            />

            <ZoruDrawer
                open={drawerDelivery !== null}
                onOpenChange={(o) => !o && setDrawerDelivery(null)}
            >
                <ZoruDrawerContent>
                    <ZoruDrawerHeader>
                        <ZoruDrawerTitle>Delivery payload</ZoruDrawerTitle>
                        <ZoruDrawerDescription>
                            Update ID {drawerDelivery?.updateId ?? '—'} •{' '}
                            {drawerDelivery?.eventType ?? '—'} • {fmtDate(drawerDelivery?.receivedAt)}
                        </ZoruDrawerDescription>
                    </ZoruDrawerHeader>
                    <div className="p-4">
                        <ZoruScrollArea className="max-h-[60vh] rounded-md border bg-muted/20 p-3">
                            <pre className="text-xs leading-relaxed">
                                {drawerDelivery
                                    ? JSON.stringify(drawerDelivery.payload ?? {}, null, 2)
                                    : ''}
                            </pre>
                        </ZoruScrollArea>
                    </div>
                </ZoruDrawerContent>
            </ZoruDrawer>

            <ZoruAlertDialog
                open={confirmDelete !== null}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Remove Telegram webhook?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            The webhook will be deleted on Telegram and the local subscription row
                            removed. Delivery log entries are kept.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDeleteSub}>Delete</ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ZoruAlertDialog open={confirmRotateAll} onOpenChange={setConfirmRotateAll}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Rotate every webhook secret?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This calls Telegram setWebhook with a fresh secret for every bot in this
                            project. Deliveries-in-flight may briefly 401.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleRotateAll}>
                            Rotate all
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ZoruAlertDialog
                open={confirmDlqDelete !== null}
                onOpenChange={(o) => !o && setConfirmDlqDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete DLQ item?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This permanently removes the queued payload. Retry won't be possible
                            afterward.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDlqDelete}>Delete</ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}

// ===========================================================================
//  Subscriptions section
// ===========================================================================

function SubscriptionsSection({
    loading,
    error,
    subs,
    onEdit,
    onTest,
    onRotate,
    onDelete,
    onAddNew,
}: {
    loading: boolean;
    error: string | null;
    subs: WebhookSubscriptionRow[];
    onEdit: (s: WebhookSubscriptionRow) => void;
    onTest: (s: WebhookSubscriptionRow) => void;
    onRotate: (s: WebhookSubscriptionRow) => void;
    onDelete: (s: WebhookSubscriptionRow) => void;
    onAddNew: () => void;
}) {
    if (loading) {
        return (
            <ZoruCard>
                <ZoruCardContent className="space-y-2 p-4">
                    {[0, 1, 2].map((i) => (
                        <ZoruSkeleton key={i} className="h-16 w-full" />
                    ))}
                </ZoruCardContent>
            </ZoruCard>
        );
    }
    if (error) {
        return (
            <ZoruCard>
                <ZoruCardContent className="p-6">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        );
    }
    if (subs.length === 0) {
        return (
            <ZoruEmptyState
                icon={<Webhook className="h-8 w-8" />}
                title="No webhook subscriptions yet"
                description="Save a URL for one of your bots to start collecting deliveries."
                action={
                    <ZoruButton onClick={onAddNew}>
                        <Pencil className="mr-2 h-4 w-4" /> Configure a webhook
                    </ZoruButton>
                }
            />
        );
    }
    return (
        <div className="space-y-3">
            {subs.map((s) => (
                <SubscriptionRow
                    key={s._id}
                    s={s}
                    onEdit={() => onEdit(s)}
                    onTest={() => onTest(s)}
                    onRotate={() => onRotate(s)}
                    onDelete={() => onDelete(s)}
                />
            ))}
        </div>
    );
}

function SubscriptionRow({
    s,
    onEdit,
    onTest,
    onRotate,
    onDelete,
}: {
    s: WebhookSubscriptionRow;
    onEdit: () => void;
    onTest: () => void;
    onRotate: () => void;
    onDelete: () => void;
}) {
    const [showSecret, setShowSecret] = React.useState(false);
    return (
        <ZoruCard>
            <ZoruCardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruBadge variant="info">@{s.botUsername ?? s.botId.slice(0, 8)}</ZoruBadge>
                        <code className="break-all rounded bg-muted px-2 py-0.5 text-xs">{s.url}</code>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Max conns: {s.maxConnections}</span>
                        <span>•</span>
                        <span>Drop pending: {s.dropPendingUpdates ? 'on' : 'off'}</span>
                        <span>•</span>
                        <span>Last set: {fmtDate(s.lastSetAt)}</span>
                        {s.pendingUpdateCount !== undefined && (
                            <>
                                <span>•</span>
                                <span>Pending: {s.pendingUpdateCount}</span>
                            </>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {s.allowedUpdates.map((u) => (
                            <ZoruBadge key={u} variant="ghost">
                                {u}
                            </ZoruBadge>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <ZoruLabel>Secret:</ZoruLabel>
                        <code className="rounded bg-muted px-2 py-0.5">
                            {showSecret ? s.secretToken ?? '—' : maskSecret(s.secretToken)}
                        </code>
                        <ZoruButton
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setShowSecret((v) => !v)}
                        >
                            {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </ZoruButton>
                        {s.secretToken && (
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(s.secretToken ?? '');
                                }}
                            >
                                <Copy className="h-3 w-3" />
                            </ZoruButton>
                        )}
                    </div>
                    {s.lastTelegramErrorMessage && (
                        <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            {s.lastTelegramErrorMessage}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ZoruButton variant="outline" size="sm" onClick={onEdit}>
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" onClick={onTest}>
                        <Play className="mr-1 h-3 w-3" /> Test
                    </ZoruButton>
                    <ZoruButton variant="outline" size="sm" onClick={onRotate}>
                        <ShieldCheck className="mr-1 h-3 w-3" /> Rotate
                    </ZoruButton>
                    <ZoruButton variant="destructive" size="sm" onClick={onDelete}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </ZoruButton>
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}

// ===========================================================================
//  Subscription drawer
// ===========================================================================

function SubscriptionDrawer({
    open,
    onClose,
    projectId,
    subs,
    editing,
    onSaved,
    onError,
}: {
    open: boolean;
    onClose: () => void;
    projectId: string;
    subs: WebhookSubscriptionRow[];
    editing: WebhookSubscriptionRow | null;
    onSaved: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const [url, setUrl] = React.useState('');
    const [secret, setSecret] = React.useState('');
    const [allowed, setAllowed] = React.useState<string[]>([]);
    const [maxConns, setMaxConns] = React.useState(40);
    const [dropPending, setDropPending] = React.useState(false);
    const [showSecret, setShowSecret] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [botId, setBotId] = React.useState('');

    React.useEffect(() => {
        if (!editing) return;
        setUrl(editing.url ?? '');
        setSecret(editing.secretToken ?? '');
        setAllowed(editing.allowedUpdates ?? []);
        setMaxConns(editing.maxConnections ?? 40);
        setDropPending(editing.dropPendingUpdates ?? false);
        setBotId(editing.botId ?? '');
        setShowSecret(false);
    }, [editing]);

    async function save() {
        if (!botId) {
            onError('Pick a bot to attach this webhook to.');
            return;
        }
        if (!/^https:\/\//i.test(url)) {
            onError('URL must start with https://');
            return;
        }
        setSaving(true);
        try {
            const res = await putTelegramWebhookSubscriptionAction(botId, {
                projectId,
                url,
                secretToken: secret || undefined,
                allowedUpdates: allowed,
                maxConnections: maxConns,
                dropPendingUpdates: dropPending,
            });
            if (res.success) {
                await onSaved();
            } else {
                onError(res.error ?? 'unknown error');
            }
        } finally {
            setSaving(false);
        }
    }

    function toggle(v: string) {
        setAllowed((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
    }

    return (
        <ZoruDrawer open={open} onOpenChange={(o) => !o && onClose()}>
            <ZoruDrawerContent>
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>
                        {editing?._id ? 'Edit webhook subscription' : 'New webhook subscription'}
                    </ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        Calls Telegram setWebhook with these settings and persists them locally.
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="flex flex-col gap-4 p-4">
                    {!editing?._id && (
                        <div>
                            <ZoruLabel>Bot</ZoruLabel>
                            <ZoruSelect value={botId} onValueChange={setBotId}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Pick a bot…" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {subs.map((s) => (
                                        <ZoruSelectItem key={s.botId} value={s.botId}>
                                            @{s.botUsername ?? s.botId.slice(0, 8)}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            {subs.length === 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    No bots configured yet — connect one under Telegram → Bots
                                    first.
                                </p>
                            )}
                        </div>
                    )}
                    <div>
                        <ZoruLabel>URL (https only)</ZoruLabel>
                        <ZoruInput
                            placeholder="https://example.com/api/telegram/webhook/…"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                    <div>
                        <ZoruLabel>Secret token</ZoruLabel>
                        <div className="flex items-center gap-2">
                            <ZoruInput
                                type={showSecret ? 'text' : 'password'}
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                                placeholder="(generated if empty)"
                            />
                            <ZoruButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSecret((v) => !v)}
                            >
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </ZoruButton>
                        </div>
                    </div>
                    <div>
                        <ZoruLabel>
                            Allowed updates ({allowed.length} of {TELEGRAM_ALLOWED_UPDATES.length})
                        </ZoruLabel>
                        <div className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-3">
                            {TELEGRAM_ALLOWED_UPDATES.map((u) => (
                                <label
                                    key={u}
                                    className="flex items-center gap-2 rounded px-1 text-xs hover:bg-muted/50"
                                >
                                    <ZoruCheckbox
                                        checked={allowed.includes(u)}
                                        onCheckedChange={() => toggle(u)}
                                    />
                                    {u}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <ZoruLabel>Max connections: {maxConns}</ZoruLabel>
                        <input
                            type="range"
                            min={1}
                            max={100}
                            value={maxConns}
                            onChange={(e) => setMaxConns(parseInt(e.target.value, 10))}
                            className="w-full accent-[#229ED9]"
                        />
                    </div>
                    <label className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <div className="text-sm font-medium">Drop pending updates</div>
                            <p className="text-xs text-muted-foreground">
                                Discard updates Telegram queued before the new webhook was set.
                            </p>
                        </div>
                        <ZoruSwitch checked={dropPending} onCheckedChange={setDropPending} />
                    </label>
                </div>
                <div className="flex items-center justify-end gap-2 border-t p-4">
                    <ZoruButton variant="outline" onClick={onClose}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton onClick={save} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </ZoruButton>
                </div>
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}

// ===========================================================================
//  Deliveries section
// ===========================================================================

function DeliveriesSection(props: {
    loading: boolean;
    deliveries: WebhookDeliveryRow[];
    hasMore: boolean;
    botOptions: { value: string; label: string }[];
    bot: string;
    event: string;
    status: string;
    search: string;
    range: { from?: Date; to?: Date };
    onBot: (v: string) => void;
    onEvent: (v: string) => void;
    onStatus: (v: string) => void;
    onSearch: (v: string) => void;
    onRange: (r: { from?: Date; to?: Date }) => void;
    onApply: () => void;
    onMore: () => void;
    onView: (d: WebhookDeliveryRow) => void;
    onReplay: (d: WebhookDeliveryRow) => void;
}) {
    return (
        <div className="space-y-3">
            <ZoruCard>
                <ZoruCardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
                    <ZoruSelect value={props.bot} onValueChange={props.onBot}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Bot" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {props.botOptions.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={props.event} onValueChange={props.onEvent}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Event type" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {EVENT_TYPE_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={props.status} onValueChange={props.onStatus}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                            <ZoruSelectItem value="received">Received</ZoruSelectItem>
                            <ZoruSelectItem value="processed">Processed</ZoruSelectItem>
                            <ZoruSelectItem value="failed">Failed</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <ZoruInput
                            className="pl-8"
                            placeholder="chatId or userId"
                            value={props.search}
                            onChange={(e) => props.onSearch(e.target.value)}
                        />
                    </div>
                    <ZoruDateRangePicker value={props.range} onChange={props.onRange} />
                    <ZoruButton onClick={props.onApply}>
                        <Search className="mr-2 h-4 w-4" /> Apply
                    </ZoruButton>
                </ZoruCardContent>
            </ZoruCard>

            {props.loading && props.deliveries.length === 0 ? (
                <ZoruCard>
                    <ZoruCardContent className="p-4">
                        <ZoruSkeleton className="h-40 w-full" />
                    </ZoruCardContent>
                </ZoruCard>
            ) : props.deliveries.length === 0 ? (
                <ZoruEmptyState
                    icon={<Inbox className="h-8 w-8" />}
                    title="No deliveries match these filters"
                    description="Webhook deliveries land here as Telegram POSTs them. Adjust filters or wait for traffic."
                />
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Received</th>
                                        <th className="px-3 py-2 text-left">Event</th>
                                        <th className="px-3 py-2 text-left">Chat</th>
                                        <th className="px-3 py-2 text-left">From user</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-right">Duration</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.deliveries.map((d) => (
                                        <tr
                                            key={d._id}
                                            className="border-b last:border-0 hover:bg-muted/20"
                                        >
                                            <td className="whitespace-nowrap px-3 py-2">
                                                {fmtDate(d.receivedAt)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <ZoruBadge variant="ghost">{d.eventType}</ZoruBadge>
                                            </td>
                                            <td className="px-3 py-2">{d.chatId ?? '—'}</td>
                                            <td className="px-3 py-2">{d.fromUserId ?? '—'}</td>
                                            <td className="px-3 py-2">
                                                <ZoruBadge variant={STATUS_VARIANT[d.status] ?? 'ghost'}>
                                                    {d.status}
                                                </ZoruBadge>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                {d.processingDurationMs != null
                                                    ? `${d.processingDurationMs} ms`
                                                    : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => props.onView(d)}
                                                >
                                                    <Eye className="h-3 w-3" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => props.onReplay(d)}
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                </ZoruButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {props.hasMore && (
                            <div className="border-t p-3 text-center">
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={props.onMore}
                                    disabled={props.loading}
                                >
                                    {props.loading ? (
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : (
                                        <ChevronDown className="mr-2 h-3 w-3" />
                                    )}
                                    Load more
                                </ZoruButton>
                            </div>
                        )}
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}

// ===========================================================================
//  DLQ section
// ===========================================================================

function DlqSection(props: {
    loading: boolean;
    items: WebhookDlqRow[];
    botOptions: { value: string; label: string }[];
    bot: string;
    status: string;
    onBot: (v: string) => void;
    onStatus: (v: string) => void;
    onApply: () => void;
    onRetry: (d: WebhookDlqRow) => void;
    onResolve: (d: WebhookDlqRow) => void;
    onDelete: (d: WebhookDlqRow) => void;
}) {
    return (
        <div className="space-y-3">
            <ZoruCard>
                <ZoruCardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-4">
                    <ZoruSelect value={props.bot} onValueChange={props.onBot}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Bot" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {props.botOptions.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruSelect value={props.status} onValueChange={props.onStatus}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                            <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                            <ZoruSelectItem value="retrying">Retrying</ZoruSelectItem>
                            <ZoruSelectItem value="failed_permanent">
                                Failed (permanent)
                            </ZoruSelectItem>
                            <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                    <ZoruButton onClick={props.onApply}>
                        <Search className="mr-2 h-4 w-4" /> Apply
                    </ZoruButton>
                </ZoruCardContent>
            </ZoruCard>
            {props.loading && props.items.length === 0 ? (
                <ZoruSkeleton className="h-40 w-full" />
            ) : props.items.length === 0 ? (
                <ZoruEmptyState
                    icon={<ShieldCheck className="h-8 w-8" />}
                    title="The DLQ is empty"
                    description="Failed deliveries land here. The worker auto-retries pending items on a schedule."
                />
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Last attempt</th>
                                        <th className="px-3 py-2 text-right">Attempts</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-left">Last error</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.items.map((d) => (
                                        <tr
                                            key={d._id}
                                            className="border-b last:border-0 hover:bg-muted/20"
                                        >
                                            <td className="whitespace-nowrap px-3 py-2">
                                                {fmtDate(d.lastAttemptAt)}
                                            </td>
                                            <td className="px-3 py-2 text-right">{d.attempts}</td>
                                            <td className="px-3 py-2">
                                                <ZoruBadge variant={STATUS_VARIANT[d.status] ?? 'ghost'}>
                                                    {d.status}
                                                </ZoruBadge>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="line-clamp-1 max-w-[40ch] text-xs text-muted-foreground">
                                                    {d.lastError ?? '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => props.onRetry(d)}
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => props.onResolve(d)}
                                                >
                                                    <ChevronRight className="h-3 w-3" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => props.onDelete(d)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </ZoruButton>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}

// ===========================================================================
//  Analytics section
// ===========================================================================

function AnalyticsSection({
    loading,
    analytics,
}: {
    loading: boolean;
    analytics: AnalyticsResp | null;
}) {
    if (loading) {
        return <ZoruSkeleton className="h-72 w-full" />;
    }
    if (!analytics) {
        return (
            <ZoruEmptyState
                icon={<AlertCircle className="h-8 w-8" />}
                title="No analytics yet"
                description="Once deliveries arrive this section shows the 7-day trend."
            />
        );
    }
    const palette = ZORU_CHART_PALETTE;
    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <TelegramProjectGate />
            <ZoruCard className="xl:col-span-2">
                <ZoruCardContent className="p-4">
                    <h3 className="mb-2 text-sm font-medium">Deliveries & failures by day</h3>
                    <ZoruChartContainer config={{}} className="h-64 w-full">
                        <LineChart data={analytics.byDay}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <RechartsTooltip />
                            <Legend />
                            <Line type="monotone" dataKey="received" stroke={ACCENT} strokeWidth={2} />
                            <Line type="monotone" dataKey="processed" stroke={palette[1]} strokeWidth={2} />
                            <Line type="monotone" dataKey="failed" stroke={palette[3]} strokeWidth={2} />
                        </LineChart>
                    </ZoruChartContainer>
                </ZoruCardContent>
            </ZoruCard>
            <ZoruCard>
                <ZoruCardContent className="p-4">
                    <h3 className="mb-2 text-sm font-medium">By event type</h3>
                    {analytics.byEventType.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No data yet.</p>
                    ) : (
                        <ZoruChartContainer config={{}} className="h-64 w-full">
                            <PieChart>
                                <Pie
                                    data={analytics.byEventType}
                                    dataKey="count"
                                    nameKey="eventType"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                >
                                    {analytics.byEventType.map((_, i) => (
                                        <Cell key={i} fill={palette[i % palette.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend />
                            </PieChart>
                        </ZoruChartContainer>
                    )}
                </ZoruCardContent>
            </ZoruCard>
            <ZoruCard className="xl:col-span-3">
                <ZoruCardContent className="p-4">
                    <h3 className="mb-2 text-sm font-medium">Top event types</h3>
                    {analytics.byEventType.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No data yet.</p>
                    ) : (
                        <ZoruChartContainer config={{}} className="h-56 w-full">
                            <BarChart data={analytics.byEventType.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="eventType" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <RechartsTooltip />
                                <Bar dataKey="count" fill={ACCENT} />
                            </BarChart>
                        </ZoruChartContainer>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
