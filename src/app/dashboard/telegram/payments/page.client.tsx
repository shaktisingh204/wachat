'use client';

import { fmtINR } from "@/lib/utils";
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
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  StatCard,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  CreditCard,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Send,
  Link2,
  Search,
  Download,
  DollarSign,
  CheckCircle2,
  Clock3,
  Undo2,
  TestTube,
  Eye,
  Loader2,
  } from 'lucide-react';
import {
    Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  } from 'recharts';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    SabFileUrlInput,
  } from '@/components/sabfiles';

/**
 * Telegram Payments dashboard — multi-tenant, project-scoped.
 *
 * Surface (segmented views, per zoruui no-tab-UI directive):
 *   - Payments   list + analytics chart + filters + CSV export + refund
 *   - Invoices   sent invoices & invoice links from this project
 *   - Templates  reusable invoice payloads (CRUD via drawer)
 *   - Providers  saved provider tokens (CRUD + token-validity test)
 *
 * Data flows through the server actions in
 * `@/app/actions/telegram-payments.actions.ts`, which proxy to the
 * `telegram-payments` Rust BFF.
 */

import * as React from 'react';

import {
    createPaymentInvoiceLinkAction,
    createPaymentProviderAction,
    createPaymentTemplateAction,
    deletePaymentProviderAction,
    deletePaymentTemplateAction,
    getPaymentAction,
    listPaymentInvoicesAction,
    listPaymentProvidersAction,
    listPaymentTemplatesAction,
    listPaymentsAction,
    listProjectBotsForPaymentsAction,
    paymentAnalyticsAction,
    refundPaymentAction,
    sendPaymentInvoiceAction,
    testPaymentProviderAction,
    updatePaymentProviderAction,
    updatePaymentTemplateAction,
    type AnalyticsResp,
    type BotOption,
    type InvoiceRow,
    type PaymentRow,
    type ProviderRow,
    type TemplateRow,
} from '@/app/actions/telegram-payments.actions';
import type {
    PriceItem,
    UpsertTemplateBody,
} from '@/lib/rust-client/telegram-payments';

// ---------------------------------------------------------------------------
//  Constants & helpers
// ---------------------------------------------------------------------------

const ACCENT = '#229ED9';

const CURRENCY_OPTIONS = [
    { code: 'XTR', label: 'XTR — Telegram Stars' },
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' },
    { code: 'GBP', label: 'GBP' },
    { code: 'INR', label: 'INR' },
    { code: 'AUD', label: 'AUD' },
    { code: 'CAD', label: 'CAD' },
];

type View = 'payments' | 'invoices' | 'templates' | 'providers';

const VIEWS: Array<{ key: View; label: string }> = [
    { key: 'payments', label: 'Payments' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'templates', label: 'Templates' },
    { key: 'providers', label: 'Providers' },
];

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'pending', label: 'Pending' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'failed', label: 'Failed' },
];

function fmtCurrency(amountSmallestUnit: number, currency: string): string {
    if (currency === 'XTR') {
        return `${fmtINR(amountSmallestUnit, 'INR').replace('₹', '')} XTR`; // Approximation or just format number
    }
    return fmtINR(amountSmallestUnit / 100, currency);
}

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
}

function startOfNDaysAgo(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

function StatusBadge({ status }: { status: string }) {
    const tone: 'success' | 'warning' | 'danger' | 'secondary' =
        status === 'succeeded'
            ? 'success'
            : status === 'refunded'
              ? 'warning'
              : status === 'failed'
                ? 'danger'
                : 'secondary';
    return <Badge variant={tone}>{status || '—'}</Badge>;
}

// ---------------------------------------------------------------------------
//  Segmented view switcher (no tab primitive in zoruui)
// ---------------------------------------------------------------------------

function ViewSwitcher({
    view,
    onChange,
}: {
    view: View;
    onChange: (v: View) => void;
}) {
    return (
        <div className="flex gap-1 rounded-full border border-zoru-line bg-zoru-bg p-1">
            {VIEWS.map((v) => (
                <button
                    key={v.key}
                    type="button"
                    onClick={() => onChange(v.key)}
                    className={cn(
                        'h-8 rounded-full px-4 text-[12.5px] font-medium transition-colors',
                        view === v.key
                            ? 'bg-foreground text-white shadow-sm'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )}
                    aria-pressed={view === v.key}
                >
                    {v.label}
                </button>
            ))}
        </div>
    );
}

// ===========================================================================
//                                  PAGE
// ===========================================================================

export default function TelegramPaymentsPage() {
    const { activeProject } = useProject();
    const { toast } = useZoruToast();
    const projectId = activeProject?._id?.toString();

    const [view, setView] = React.useState<View>('payments');

    // shared resources — bots, providers, templates — used across views
    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [providers, setProviders] = React.useState<ProviderRow[]>([]);
    const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
    const [payments, setPayments] = React.useState<PaymentRow[]>([]);
    const [paymentsTotal, setPaymentsTotal] = React.useState(0);
    const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);

    // filters
    const [primaryCurrency, setPrimaryCurrency] = React.useState('USD');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [currencyFilter, setCurrencyFilter] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [from, setFrom] = React.useState<string>(() =>
        startOfNDaysAgo(30).toISOString(),
    );
    const [to, setTo] = React.useState<string>(() => new Date().toISOString());
    const [page, setPage] = React.useState(1);
    const PAGE_SIZE = 50;

    const [isLoading, startLoading] = React.useTransition();

    // ---------------------- loaders ----------------------

    const reloadBots = React.useCallback(async () => {
        if (!projectId) return;
        const list = await listProjectBotsForPaymentsAction(projectId);
        setBots(list);
    }, [projectId]);

    const reloadProviders = React.useCallback(async () => {
        if (!projectId) return;
        const res = await listPaymentProvidersAction(projectId);
        setProviders(res.providers ?? []);
        if (res.error) {
            toast({
                title: 'Could not load providers',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, toast]);

    const reloadTemplates = React.useCallback(async () => {
        if (!projectId) return;
        const res = await listPaymentTemplatesAction(projectId);
        setTemplates(res.templates ?? []);
        if (res.error) {
            toast({
                title: 'Could not load templates',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, toast]);

    const reloadPayments = React.useCallback(async () => {
        if (!projectId) return;
        const res = await listPaymentsAction({
            projectId,
            from,
            to,
            status: statusFilter === 'all' ? undefined : statusFilter,
            currency: currencyFilter === 'all' ? undefined : currencyFilter,
            search: search || undefined,
            page,
            pageSize: PAGE_SIZE,
        });
        setPayments(res.payments ?? []);
        setPaymentsTotal(res.total ?? 0);
        if (res.error) {
            toast({
                title: 'Could not load payments',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, from, to, statusFilter, currencyFilter, search, page, toast]);

    const reloadInvoices = React.useCallback(async () => {
        if (!projectId) return;
        const res = await listPaymentInvoicesAction(projectId);
        setInvoices(res.invoices ?? []);
        if (res.error) {
            toast({
                title: 'Could not load invoices',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, toast]);

    const reloadAnalytics = React.useCallback(async () => {
        if (!projectId) return;
        const res = await paymentAnalyticsAction({ projectId, from, to });
        setAnalytics(res);
        if (res.error) {
            toast({
                title: 'Could not load analytics',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, from, to, toast]);

    const reloadAll = React.useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            await Promise.all([
                reloadBots(),
                reloadProviders(),
                reloadTemplates(),
                reloadPayments(),
                reloadInvoices(),
                reloadAnalytics(),
            ]);
        });
    }, [
        projectId,
        reloadBots,
        reloadProviders,
        reloadTemplates,
        reloadPayments,
        reloadInvoices,
        reloadAnalytics,
    ]);

    React.useEffect(() => {
        reloadAll();
    }, [reloadAll]);

    // ---------------------- KPI totals (in primary currency) ----------------------

    const kpi = React.useMemo(() => {
        if (!analytics) {
            return { revenue: 0, successful: 0, pending: 0, refunded: 0 };
        }
        const c = analytics.by_currency.find((x) => x.currency === primaryCurrency);
        return {
            revenue: c?.revenue ?? 0,
            successful: analytics.successful,
            pending: analytics.pending,
            refunded: analytics.refunded,
        };
    }, [analytics, primaryCurrency]);

    // ---------------------- CSV download ----------------------

    const handleCsvExport = React.useCallback(async () => {
        if (!projectId) return;
        try {
            const params = new URLSearchParams({ projectId });
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (currencyFilter !== 'all') params.set('currency', currencyFilter);
            if (search) params.set('search', search);

            const res = await fetch(
                `/api/telegram/payments/export?${params.toString()}`,
            );
            if (!res.ok) throw new Error(`Export failed (${res.status})`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `telegram-payments-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'CSV ready', description: 'Download started.' });
        } catch (e) {
            toast({
                title: 'CSV export failed',
                description: e instanceof Error ? e.message : String(e),
                variant: 'destructive',
            });
        }
    }, [projectId, from, to, statusFilter, currencyFilter, search, toast]);

    // ---------------------- render guard ----------------------

    if (!projectId) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="No project selected"
                    description="Pick a project from the sidebar to manage Telegram payments."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 px-6 py-6">
            <TelegramProjectGate />
            {/* Breadcrumbs */}
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard">Dashboard</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/telegram">Telegram</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Payments</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            {/* Header */}
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageEyebrow>Telegram</ZoruPageEyebrow>
                    <ZoruPageTitle>
                        <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                            style={{ background: `${ACCENT}1A`, color: ACCENT }}
                        >
                            <CreditCard className="h-5 w-5" aria-hidden />
                        </span>
                        Telegram Payments
                    </ZoruPageTitle>
                    <ZoruPageDescription>
                        Templates, invoices, provider tokens, and a full payments ledger
                        for {activeProject?.name ?? 'this project'}.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={reloadAll}
                        disabled={isLoading}
                    >
                        <RefreshCw
                            className={cn('h-4 w-4', isLoading && 'animate-spin')}
                        />
                        Refresh
                    </Button>
                </div>
            </PageHeader>

            {/* KPI strip + primary-currency picker */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label={`Revenue (${primaryCurrency})`}
                    value={
                        analytics
                            ? fmtCurrency(kpi.revenue, primaryCurrency)
                            : '—'
                    }
                    icon={<DollarSign />}
                />
                <StatCard
                    label="Successful"
                    value={String(kpi.successful)}
                    icon={<CheckCircle2 />}
                />
                <StatCard
                    label="Pending"
                    value={String(kpi.pending)}
                    icon={<Clock3 />}
                />
                <StatCard
                    label="Refunded"
                    value={String(kpi.refunded)}
                    icon={<Undo2 />}
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <ViewSwitcher view={view} onChange={setView} />
                <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                        Display currency
                    </Label>
                    <Select
                        value={primaryCurrency}
                        onValueChange={(v) => setPrimaryCurrency(v)}
                    >
                        <ZoruSelectTrigger className="w-[160px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {CURRENCY_OPTIONS.map((c) => (
                                <ZoruSelectItem key={c.code} value={c.code}>
                                    {c.code}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
            </div>

            {/* Body — one section per view */}
            {view === 'payments' && (
                <PaymentsSection
                    projectId={projectId}
                    payments={payments}
                    paymentsTotal={paymentsTotal}
                    page={page}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                    statusFilter={statusFilter}
                    onStatusFilter={setStatusFilter}
                    currencyFilter={currencyFilter}
                    onCurrencyFilter={setCurrencyFilter}
                    search={search}
                    onSearch={setSearch}
                    from={from}
                    onFromChange={setFrom}
                    to={to}
                    onToChange={setTo}
                    analytics={analytics}
                    onApply={reloadPayments}
                    onCsvExport={handleCsvExport}
                    onRefunded={reloadPayments}
                />
            )}
            {view === 'invoices' && (
                <InvoicesSection
                    invoices={invoices}
                    templates={templates}
                />
            )}
            {view === 'templates' && (
                <TemplatesSection
                    projectId={projectId}
                    templates={templates}
                    providers={providers}
                    bots={bots}
                    onChange={reloadTemplates}
                    onAfterSend={() => {
                        reloadInvoices();
                        reloadPayments();
                    }}
                />
            )}
            {view === 'providers' && (
                <ProvidersSection
                    projectId={projectId}
                    providers={providers}
                    bots={bots}
                    onChange={reloadProviders}
                />
            )}
        </div>
    );
}

// ===========================================================================
//                              PAYMENTS section
// ===========================================================================

interface PaymentsSectionProps {
    projectId: string;
    payments: PaymentRow[];
    paymentsTotal: number;
    page: number;
    pageSize: number;
    onPageChange: (n: number) => void;
    statusFilter: string;
    onStatusFilter: (s: string) => void;
    currencyFilter: string;
    onCurrencyFilter: (s: string) => void;
    search: string;
    onSearch: (s: string) => void;
    from: string;
    onFromChange: (s: string) => void;
    to: string;
    onToChange: (s: string) => void;
    analytics: AnalyticsResp | null;
    onApply: () => void;
    onCsvExport: () => void;
    onRefunded: () => void;
}

function PaymentsSection(props: PaymentsSectionProps) {
    const { toast } = useZoruToast();
    const [detail, setDetail] = React.useState<PaymentRow | null>(null);
    const [refundTarget, setRefundTarget] = React.useState<PaymentRow | null>(
        null,
    );
    const [isRefunding, setIsRefunding] = React.useState(false);

    const totalPages = Math.max(
        1,
        Math.ceil(props.paymentsTotal / props.pageSize),
    );

    const openDetail = async (row: PaymentRow) => {
        const res = await getPaymentAction(row._id, props.projectId);
        setDetail(res.payment ?? row);
    };

    const confirmRefund = async () => {
        if (!refundTarget) return;
        setIsRefunding(true);
        const res = await refundPaymentAction(refundTarget._id, {
            projectId: props.projectId,
        });
        setIsRefunding(false);
        if (res.success) {
            toast({
                title: 'Refund processed',
                description: res.message ?? 'Payment refunded.',
            });
            setRefundTarget(null);
            props.onRefunded();
        } else {
            toast({
                title: 'Refund failed',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Mini analytics chart */}
            <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium">Daily volume</div>
                        <div className="text-xs text-muted-foreground">
                            Revenue is summed across successful payments. Drag the
                            range above to focus.
                        </div>
                    </div>
                </div>
                <div className="h-[200px] w-full">
                    {props.analytics && props.analytics.by_day.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={props.analytics.by_day}
                                margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={11}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={11}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 8,
                                        fontSize: 12,
                                    }}
                                    formatter={(v: number) => [v, 'count']}
                                />
                                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No payments in this range yet.
                        </div>
                    )}
                </div>
            </Card>

            {/* Filters */}
            <Card className="flex flex-wrap items-end gap-3 p-3">
                <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                    <Label className="text-xs">Search</Label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                        <Input
                            placeholder="chat id, user id, or charge id"
                            value={props.search}
                            onChange={(e) => props.onSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                        value={props.statusFilter}
                        onValueChange={props.onStatusFilter}
                    >
                        <ZoruSelectTrigger className="w-[160px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUS_OPTIONS.map((s) => (
                                <ZoruSelectItem key={s.value} value={s.value}>
                                    {s.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Currency</Label>
                    <Select
                        value={props.currencyFilter}
                        onValueChange={props.onCurrencyFilter}
                    >
                        <ZoruSelectTrigger className="w-[140px]">
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All</ZoruSelectItem>
                            {CURRENCY_OPTIONS.map((c) => (
                                <ZoruSelectItem key={c.code} value={c.code}>
                                    {c.code}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">From</Label>
                    <Input
                        type="date"
                        value={props.from.slice(0, 10)}
                        onChange={(e) =>
                            props.onFromChange(
                                new Date(e.target.value).toISOString(),
                            )
                        }
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">To</Label>
                    <Input
                        type="date"
                        value={props.to.slice(0, 10)}
                        onChange={(e) =>
                            props.onToChange(
                                new Date(e.target.value).toISOString(),
                            )
                        }
                    />
                </div>
                <Button type="button" onClick={props.onApply}>
                    Apply
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={props.onCsvExport}
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Chat / User</ZoruTableHead>
                            <ZoruTableHead>Payload</ZoruTableHead>
                            <ZoruTableHead>Amount</ZoruTableHead>
                            <ZoruTableHead>Status</ZoruTableHead>
                            <ZoruTableHead>Created</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {props.payments.length === 0 && (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={6}>
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No payments match these filters yet.
                                    </div>
                                </ZoruTableCell>
                            </ZoruTableRow>
                        )}
                        {props.payments.map((p) => (
                            <ZoruTableRow key={p._id}>
                                <ZoruTableCell>
                                    <div className="text-sm">{p.username ?? '—'}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {p.chatId ?? p.userId ?? '—'}
                                    </div>
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    <span className="truncate font-mono text-xs">
                                        {p.payload ?? '—'}
                                    </span>
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    {fmtCurrency(p.amount, p.currency)}
                                </ZoruTableCell>
                                <ZoruTableCell>
                                    <StatusBadge status={p.status} />
                                </ZoruTableCell>
                                <ZoruTableCell>{fmtDate(p.createdAt)}</ZoruTableCell>
                                <ZoruTableCell className="text-right">
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label="View"
                                        onClick={() => openDetail(p)}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                    {p.status === 'succeeded' && (
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            aria-label="Refund"
                                            onClick={() => setRefundTarget(p)}
                                        >
                                            <Undo2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))}
                    </ZoruTableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-zoru-line px-3 py-2 text-xs">
                    <div className="text-muted-foreground">
                        Page {props.page} of {totalPages} • {props.paymentsTotal} total
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={props.page <= 1}
                            onClick={() => props.onPageChange(props.page - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={props.page >= totalPages}
                            onClick={() => props.onPageChange(props.page + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Detail dialog */}
            <Dialog
                open={!!detail}
                onOpenChange={(v) => !v && setDetail(null)}
            >
                <ZoruDialogContent className="max-w-2xl">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Payment details</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            {detail?._id}
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    {detail && (
                        <div className="grid gap-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Amount</Label>
                                    <div>{fmtCurrency(detail.amount, detail.currency)}</div>
                                </div>
                                <div>
                                    <Label className="text-xs">Status</Label>
                                    <StatusBadge status={detail.status} />
                                </div>
                                <div>
                                    <Label className="text-xs">Chat ID</Label>
                                    <div className="font-mono text-xs">
                                        {detail.chatId ?? '—'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">User ID</Label>
                                    <div className="font-mono text-xs">
                                        {detail.userId ?? '—'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Telegram charge id</Label>
                                    <div className="break-all font-mono text-xs">
                                        {detail.telegramPaymentChargeId ?? '—'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs">Provider charge id</Label>
                                    <div className="break-all font-mono text-xs">
                                        {detail.providerPaymentChargeId ?? '—'}
                                    </div>
                                </div>
                            </div>
                            {detail.orderInfo ? (
                                <div>
                                    <Label className="text-xs">Order info</Label>
                                    <pre className="max-h-40 overflow-auto rounded bg-secondary/40 p-2 text-[11px]">
                                        {JSON.stringify(detail.orderInfo, null, 2)}
                                    </pre>
                                </div>
                            ) : null}
                            {detail.shippingAddress ? (
                                <div>
                                    <Label className="text-xs">Shipping address</Label>
                                    <pre className="max-h-40 overflow-auto rounded bg-secondary/40 p-2 text-[11px]">
                                        {JSON.stringify(detail.shippingAddress, null, 2)}
                                    </pre>
                                </div>
                            ) : null}
                        </div>
                    )}
                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setDetail(null)}>
                            Close
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Refund confirm */}
            <ZoruAlertDialog
                open={!!refundTarget}
                onOpenChange={(v) => !v && setRefundTarget(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Refund this payment?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {refundTarget?.currency === 'XTR'
                                ? 'Telegram Stars will be returned to the buyer via refundStarPayment. This cannot be undone.'
                                : 'Fiat refunds are processed by your payment provider. We will mark this payment as refunded locally — reconcile with your provider for the actual refund.'}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel disabled={isRefunding}>
                            Cancel
                        </ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            disabled={isRefunding}
                            onClick={confirmRefund}
                        >
                            {isRefunding && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            Refund
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}

// ===========================================================================
//                              INVOICES section
// ===========================================================================

function InvoicesSection({
    invoices,
    templates,
}: {
    invoices: InvoiceRow[];
    templates: TemplateRow[];
}) {
    const templateMap = React.useMemo(() => {
        const m = new Map<string, TemplateRow>();
        for (const t of templates) m.set(t._id, t);
        return m;
    }, [templates]);

    return (
        <Card className="overflow-hidden">
            <Table>
                <ZoruTableHeader>
                    <ZoruTableRow>
                        <ZoruTableHead>Template</ZoruTableHead>
                        <ZoruTableHead>Chat ID</ZoruTableHead>
                        <ZoruTableHead>Amount</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Link</ZoruTableHead>
                        <ZoruTableHead>Created</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {invoices.length === 0 && (
                        <ZoruTableRow>
                            <ZoruTableCell colSpan={6}>
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    No invoices sent or created yet.
                                </div>
                            </ZoruTableCell>
                        </ZoruTableRow>
                    )}
                    {invoices.map((inv) => (
                        <ZoruTableRow key={inv._id}>
                            <ZoruTableCell>
                                {inv.templateId
                                    ? (templateMap.get(inv.templateId)?.name ?? inv.title)
                                    : inv.title}
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <span className="font-mono text-xs">
                                    {inv.chatId ?? '—'}
                                </span>
                            </ZoruTableCell>
                            <ZoruTableCell>
                                {fmtCurrency(inv.amount, inv.currency)}
                            </ZoruTableCell>
                            <ZoruTableCell>
                                <StatusBadge status={inv.status} />
                            </ZoruTableCell>
                            <ZoruTableCell>
                                {inv.invoiceLink ? (
                                    <a
                                        href={inv.invoiceLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs underline"
                                    >
                                        Open
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </ZoruTableCell>
                            <ZoruTableCell>{fmtDate(inv.createdAt)}</ZoruTableCell>
                        </ZoruTableRow>
                    ))}
                </ZoruTableBody>
            </Table>
        </Card>
    );
}

// ===========================================================================
//                              TEMPLATES section
// ===========================================================================

function TemplatesSection({
    projectId,
    templates,
    providers,
    bots,
    onChange,
    onAfterSend,
}: {
    projectId: string;
    templates: TemplateRow[];
    providers: ProviderRow[];
    bots: BotOption[];
    onChange: () => void;
    onAfterSend: () => void;
}) {
    const { toast } = useZoruToast();
    const [drawer, setDrawer] = React.useState<{ open: boolean; editing: TemplateRow | null }>({
        open: false,
        editing: null,
    });
    const [sendDialog, setSendDialog] = React.useState<TemplateRow | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<TemplateRow | null>(
        null,
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Invoice templates</h2>
                <Button
                    onClick={() => setDrawer({ open: true, editing: null })}
                >
                    <Plus className="h-4 w-4" />
                    New template
                </Button>
            </div>
            <Card className="overflow-hidden">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Name</ZoruTableHead>
                            <ZoruTableHead>Title</ZoruTableHead>
                            <ZoruTableHead>Currency</ZoruTableHead>
                            <ZoruTableHead>Amount</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {templates.length === 0 && (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={5}>
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No templates yet. Create one to send invoices.
                                    </div>
                                </ZoruTableCell>
                            </ZoruTableRow>
                        )}
                        {templates.map((t) => {
                            const total = t.prices.reduce(
                                (sum, p) => sum + p.amountCents,
                                0,
                            );
                            return (
                                <ZoruTableRow key={t._id}>
                                    <ZoruTableCell>{t.name}</ZoruTableCell>
                                    <ZoruTableCell>{t.title}</ZoruTableCell>
                                    <ZoruTableCell>{t.currency}</ZoruTableCell>
                                    <ZoruTableCell>
                                        {fmtCurrency(total, t.currency)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() => setSendDialog(t)}
                                            aria-label="Send invoice"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setDrawer({ open: true, editing: t })
                                            }
                                            aria-label="Edit"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() => setDeleteTarget(t)}
                                            aria-label="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                    </ZoruTableBody>
                </Table>
            </Card>

            {drawer.open && (
                <TemplateDrawer
                    projectId={projectId}
                    open={drawer.open}
                    editing={drawer.editing}
                    providers={providers}
                    onClose={() => setDrawer({ open: false, editing: null })}
                    onSaved={() => {
                        setDrawer({ open: false, editing: null });
                        onChange();
                    }}
                />
            )}
            {sendDialog && (
                <SendInvoiceDialog
                    projectId={projectId}
                    template={sendDialog}
                    bots={bots}
                    onClose={() => setSendDialog(null)}
                    onSent={() => {
                        setSendDialog(null);
                        onAfterSend();
                    }}
                />
            )}

            <ZoruAlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete &ldquo;{deleteTarget?.name}&rdquo;?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Existing invoices and payments using this template are
                            preserved; only the template definition is removed.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={async () => {
                                if (!deleteTarget) return;
                                const r = await deletePaymentTemplateAction(
                                    deleteTarget._id,
                                    projectId,
                                );
                                if (r.success) {
                                    toast({ title: 'Template deleted' });
                                    setDeleteTarget(null);
                                    onChange();
                                } else {
                                    toast({
                                        title: 'Delete failed',
                                        description: r.error,
                                        variant: 'destructive',
                                    });
                                }
                            }}
                        >
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}

// -- Template drawer --------------------------------------------------------

function TemplateDrawer({
    projectId,
    open,
    editing,
    providers,
    onClose,
    onSaved,
}: {
    projectId: string;
    open: boolean;
    editing: TemplateRow | null;
    providers: ProviderRow[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { toast } = useZoruToast();
    const [name, setName] = React.useState(editing?.name ?? '');
    const [title, setTitle] = React.useState(editing?.title ?? '');
    const [description, setDescription] = React.useState(editing?.description ?? '');
    const [payload, setPayload] = React.useState(editing?.payload ?? '');
    const [currency, setCurrency] = React.useState(editing?.currency ?? 'XTR');
    const [photoUrl, setPhotoUrl] = React.useState(editing?.photoUrl ?? '');
    const [providerId, setProviderId] = React.useState(editing?.providerId ?? '');
    const [needName, setNeedName] = React.useState(editing?.needName ?? false);
    const [needPhone, setNeedPhone] = React.useState(editing?.needPhone ?? false);
    const [needEmail, setNeedEmail] = React.useState(editing?.needEmail ?? false);
    const [needShipping, setNeedShipping] = React.useState(
        editing?.needShipping ?? false,
    );
    const [isFlexible, setIsFlexible] = React.useState(
        editing?.isFlexible ?? false,
    );
    const [prices, setPrices] = React.useState<PriceItem[]>(
        editing?.prices && editing.prices.length > 0
            ? editing.prices
            : [{ label: 'Total', amountCents: 0 }],
    );
    const [saving, setSaving] = React.useState(false);

    const addPrice = () =>
        setPrices((p) => [...p, { label: '', amountCents: 0 }]);
    const removePrice = (i: number) =>
        setPrices((p) => p.filter((_, idx) => idx !== i));
    const updatePrice = (i: number, patch: Partial<PriceItem>) =>
        setPrices((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

    const handleSave = async () => {
        setSaving(true);
        const body: UpsertTemplateBody = {
            projectId,
            name: name.trim(),
            title: title.trim(),
            description: description.trim(),
            payload: payload.trim(),
            currency,
            prices: prices
                .filter((p) => p.label.trim() !== '')
                .map((p) => ({
                    label: p.label.trim(),
                    amountCents: Number(p.amountCents) || 0,
                })),
            photoUrl: photoUrl || undefined,
            needName,
            needPhone,
            needEmail,
            needShipping,
            isFlexible,
            providerId: providerId || undefined,
        };
        const res = editing
            ? await updatePaymentTemplateAction(editing._id, body)
            : await createPaymentTemplateAction(body);
        setSaving(false);
        if (res.success) {
            toast({
                title: editing ? 'Template updated' : 'Template created',
                description: res.message ?? '',
            });
            onSaved();
        } else {
            toast({
                title: 'Could not save',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruSheetContent className="w-full sm:max-w-xl">
                <ZoruSheetHeader>
                    <ZoruSheetTitle>
                        {editing ? 'Edit template' : 'New invoice template'}
                    </ZoruSheetTitle>
                    <ZoruSheetDescription>
                        Templates are reusable invoice payloads. The buyer-facing
                        title and description are taken from here; the payload is
                        the opaque string returned in the successful_payment update.
                    </ZoruSheetDescription>
                </ZoruSheetHeader>

                <div className="flex flex-col gap-3 py-4">
                    <Field label="Name (internal)">
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="Title (buyer-visible)">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={32}
                        />
                    </Field>
                    <Field label="Description">
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={255}
                            rows={3}
                        />
                    </Field>
                    <Field label="Payload (echoed back in webhooks)">
                        <Input
                            value={payload}
                            onChange={(e) => setPayload(e.target.value)}
                            maxLength={128}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Currency">
                            <Select value={currency} onValueChange={setCurrency}>
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {CURRENCY_OPTIONS.map((c) => (
                                        <ZoruSelectItem key={c.code} value={c.code}>
                                            {c.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Provider (non-XTR only)">
                            <Select
                                value={providerId || 'none'}
                                onValueChange={(v) =>
                                    setProviderId(v === 'none' ? '' : v)
                                }
                                disabled={currency === 'XTR'}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="None" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="none">None</ZoruSelectItem>
                                    {providers.map((p) => (
                                        <ZoruSelectItem key={p._id} value={p._id}>
                                            {p.label} ({p.currency})
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                    </div>

                    <Field label="Photo (from SabFiles)">
                        <SabFileUrlInput
                            value={photoUrl}
                            onChange={setPhotoUrl}
                            accept="image"
                            placeholder="No photo chosen"
                        />
                    </Field>

                    {/* Prices */}
                    <div className="rounded-md border border-zoru-line p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <Label>Price lines</Label>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={addPrice}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add line
                            </Button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {prices.map((p, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <Input
                                        placeholder="Label"
                                        value={p.label}
                                        onChange={(e) =>
                                            updatePrice(i, { label: e.target.value })
                                        }
                                        className="flex-1"
                                    />
                                    <Input
                                        placeholder={
                                            currency === 'XTR'
                                                ? 'Amount (XTR)'
                                                : 'Amount (cents)'
                                        }
                                        type="number"
                                        value={p.amountCents}
                                        onChange={(e) =>
                                            updatePrice(i, {
                                                amountCents: Number(e.target.value) || 0,
                                            })
                                        }
                                        className="w-40"
                                    />
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => removePrice(i)}
                                        aria-label="Remove line"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                        <ToggleRow label="Collect name" value={needName} onChange={setNeedName} />
                        <ToggleRow label="Collect phone" value={needPhone} onChange={setNeedPhone} />
                        <ToggleRow label="Collect email" value={needEmail} onChange={setNeedEmail} />
                        <ToggleRow
                            label="Collect shipping address"
                            value={needShipping}
                            onChange={setNeedShipping}
                        />
                        <ToggleRow
                            label="Flexible (final total set in webhook)"
                            value={isFlexible}
                            onChange={setIsFlexible}
                        />
                    </div>
                </div>

                <ZoruSheetFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {editing ? 'Save changes' : 'Create template'}
                    </Button>
                </ZoruSheetFooter>
            </ZoruSheetContent>
        </Sheet>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs">{label}</Label>
            {children}
        </div>
    );
}

function ToggleRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex items-center justify-between gap-2 rounded border border-zoru-line bg-zoru-bg px-3 py-2 text-sm">
            <span>{label}</span>
            <Switch checked={value} onCheckedChange={onChange} />
        </label>
    );
}

// -- Send invoice dialog ----------------------------------------------------

function SendInvoiceDialog({
    projectId,
    template,
    bots,
    onClose,
    onSent,
}: {
    projectId: string;
    template: TemplateRow;
    bots: BotOption[];
    onClose: () => void;
    onSent: () => void;
}) {
    const { toast } = useZoruToast();
    const [mode, setMode] = React.useState<'send' | 'link'>('send');
    const [chatId, setChatId] = React.useState('');
    const [botId, setBotId] = React.useState(bots[0]?.id ?? '');
    const [busy, setBusy] = React.useState(false);
    const [linkResult, setLinkResult] = React.useState<string | null>(null);

    const doSend = async () => {
        setBusy(true);
        const res = await sendPaymentInvoiceAction({
            projectId,
            templateId: template._id,
            botId,
            chatId,
        });
        setBusy(false);
        if (res.success) {
            toast({ title: 'Invoice sent', description: `Message id ${res.id ?? ''}` });
            onSent();
        } else {
            toast({
                title: 'Send failed',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    const doLink = async () => {
        setBusy(true);
        const res = await createPaymentInvoiceLinkAction({
            projectId,
            templateId: template._id,
            botId: botId || undefined,
        });
        setBusy(false);
        if (res.success) {
            setLinkResult(res.invoiceLink ?? null);
            toast({ title: 'Invoice link created' });
        } else {
            toast({
                title: 'Link failed',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Send / link invoice</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Template <strong>{template.name}</strong>. Either send it
                        directly to a chat, or get a shareable invoice link.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="flex gap-1 rounded-full border border-zoru-line bg-zoru-bg p-1">
                    {(['send', 'link'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={cn(
                                'h-7 flex-1 rounded-full text-xs',
                                mode === m
                                    ? 'bg-foreground text-white'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {m === 'send' ? (
                                <>
                                    <Send className="mr-1 inline h-3 w-3" /> Send to chat
                                </>
                            ) : (
                                <>
                                    <Link2 className="mr-1 inline h-3 w-3" /> Invoice link
                                </>
                            )}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    <Field label="Bot">
                        <Select
                            value={botId}
                            onValueChange={setBotId}
                            disabled={bots.length === 0}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Pick a bot" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {bots.map((b) => (
                                    <ZoruSelectItem key={b.id} value={b.id}>
                                        @{b.username || b.name}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </Field>
                    {mode === 'send' ? (
                        <Field label="Chat ID">
                            <Input
                                placeholder="-100… or numeric user id"
                                value={chatId}
                                onChange={(e) => setChatId(e.target.value)}
                            />
                        </Field>
                    ) : null}
                    {linkResult ? (
                        <div className="rounded border border-zoru-line bg-secondary/40 p-2 text-xs">
                            <div className="mb-1 text-muted-foreground">Invoice link:</div>
                            <a
                                href={linkResult}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all underline"
                            >
                                {linkResult}
                            </a>
                        </div>
                    ) : null}
                </div>
                <ZoruDialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Close
                    </Button>
                    {mode === 'send' ? (
                        <Button
                            onClick={doSend}
                            disabled={busy || !botId || !chatId.trim()}
                        >
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Send invoice
                        </Button>
                    ) : (
                        <Button onClick={doLink} disabled={busy}>
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Create link
                        </Button>
                    )}
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </Dialog>
    );
}

// ===========================================================================
//                              PROVIDERS section
// ===========================================================================

function ProvidersSection({
    projectId,
    providers,
    bots,
    onChange,
}: {
    projectId: string;
    providers: ProviderRow[];
    bots: BotOption[];
    onChange: () => void;
}) {
    const { toast } = useZoruToast();
    const [drawer, setDrawer] = React.useState<{ open: boolean; editing: ProviderRow | null }>({
        open: false,
        editing: null,
    });
    const [deleteTarget, setDeleteTarget] = React.useState<ProviderRow | null>(
        null,
    );
    const [testingId, setTestingId] = React.useState<string | null>(null);

    const handleTest = async (p: ProviderRow) => {
        setTestingId(p._id);
        const res = await testPaymentProviderAction(p._id, projectId);
        setTestingId(null);
        if (res.success) {
            toast({ title: 'Provider OK', description: res.message ?? '' });
        } else {
            toast({
                title: 'Provider test failed',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Provider tokens</h2>
                <Button
                    onClick={() => setDrawer({ open: true, editing: null })}
                    disabled={bots.length === 0}
                >
                    <Plus className="h-4 w-4" />
                    Add provider
                </Button>
            </div>
            {bots.length === 0 && (
                <Card className="p-4 text-sm text-muted-foreground">
                    Connect a Telegram bot to this project first — provider tokens
                    are attached to a specific bot.
                </Card>
            )}
            <Card className="overflow-hidden">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Label</ZoruTableHead>
                            <ZoruTableHead>Bot</ZoruTableHead>
                            <ZoruTableHead>Token</ZoruTableHead>
                            <ZoruTableHead>Currency</ZoruTableHead>
                            <ZoruTableHead>Mode</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {providers.length === 0 && (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={6}>
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No provider tokens saved yet.
                                    </div>
                                </ZoruTableCell>
                            </ZoruTableRow>
                        )}
                        {providers.map((p) => {
                            const bot = bots.find((b) => b.id === p.botId);
                            return (
                                <ZoruTableRow key={p._id}>
                                    <ZoruTableCell>{p.label}</ZoruTableCell>
                                    <ZoruTableCell>
                                        @{bot?.username ?? '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <span className="font-mono text-xs">
                                            {p.providerTokenMasked}
                                        </span>
                                    </ZoruTableCell>
                                    <ZoruTableCell>{p.currency}</ZoruTableCell>
                                    <ZoruTableCell>
                                        <Badge variant={p.testMode ? 'warning' : 'success'}>
                                            {p.testMode ? 'Test' : 'Live'}
                                        </Badge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            disabled={testingId === p._id}
                                            onClick={() => handleTest(p)}
                                            aria-label="Test provider"
                                        >
                                            {testingId === p._id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <TestTube className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() =>
                                                setDrawer({ open: true, editing: p })
                                            }
                                            aria-label="Edit"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() => setDeleteTarget(p)}
                                            aria-label="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                    </ZoruTableBody>
                </Table>
            </Card>

            {drawer.open && (
                <ProviderDrawer
                    projectId={projectId}
                    open={drawer.open}
                    editing={drawer.editing}
                    bots={bots}
                    onClose={() => setDrawer({ open: false, editing: null })}
                    onSaved={() => {
                        setDrawer({ open: false, editing: null });
                        onChange();
                    }}
                />
            )}

            <ZoruAlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete provider &ldquo;{deleteTarget?.label}&rdquo;?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Templates referencing this provider will need a new
                            provider before sending non-XTR invoices.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={async () => {
                                if (!deleteTarget) return;
                                const r = await deletePaymentProviderAction(
                                    deleteTarget._id,
                                    projectId,
                                );
                                if (r.success) {
                                    toast({ title: 'Provider removed' });
                                    setDeleteTarget(null);
                                    onChange();
                                } else {
                                    toast({
                                        title: 'Delete failed',
                                        description: r.error,
                                        variant: 'destructive',
                                    });
                                }
                            }}
                        >
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}

function ProviderDrawer({
    projectId,
    open,
    editing,
    bots,
    onClose,
    onSaved,
}: {
    projectId: string;
    open: boolean;
    editing: ProviderRow | null;
    bots: BotOption[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { toast } = useZoruToast();
    const [label, setLabel] = React.useState(editing?.label ?? '');
    const [botId, setBotId] = React.useState(editing?.botId ?? bots[0]?.id ?? '');
    const [providerToken, setProviderToken] = React.useState('');
    const [currency, setCurrency] = React.useState(editing?.currency ?? 'USD');
    const [testMode, setTestMode] = React.useState(editing?.testMode ?? false);
    const [busy, setBusy] = React.useState(false);

    const handleSave = async () => {
        setBusy(true);
        const res = editing
            ? await updatePaymentProviderAction(editing._id, {
                  projectId,
                  label: label.trim() || undefined,
                  providerToken: providerToken.trim() || undefined,
                  currency,
                  testMode,
              })
            : await createPaymentProviderAction({
                  projectId,
                  botId,
                  label: label.trim(),
                  providerToken: providerToken.trim(),
                  currency,
                  testMode,
              });
        setBusy(false);
        if (res.success) {
            toast({
                title: editing ? 'Provider updated' : 'Provider saved',
            });
            onSaved();
        } else {
            toast({
                title: 'Save failed',
                description: res.error ?? 'Unknown error.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruSheetContent className="w-full sm:max-w-md">
                <ZoruSheetHeader>
                    <ZoruSheetTitle>
                        {editing ? 'Edit provider' : 'New provider token'}
                    </ZoruSheetTitle>
                    <ZoruSheetDescription>
                        Tokens are issued by BotFather + your payment provider.
                        Provider tokens are stored server-side and never returned
                        to the browser.
                    </ZoruSheetDescription>
                </ZoruSheetHeader>
                <div className="flex flex-col gap-3 py-4">
                    <Field label="Label">
                        <Input
                            placeholder="e.g. Stripe — USD"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                        />
                    </Field>
                    {!editing && (
                        <Field label="Bot">
                            <Select
                                value={botId}
                                onValueChange={setBotId}
                                disabled={bots.length === 0}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Pick a bot" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {bots.map((b) => (
                                        <ZoruSelectItem key={b.id} value={b.id}>
                                            @{b.username || b.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                    )}
                    <Field
                        label={
                            editing
                                ? 'New provider token (leave empty to keep current)'
                                : 'Provider token'
                        }
                    >
                        <Input
                            type="password"
                            value={providerToken}
                            onChange={(e) => setProviderToken(e.target.value)}
                            placeholder="284685063:TEST:…"
                            autoComplete="off"
                        />
                    </Field>
                    <Field label="Currency">
                        <Select value={currency} onValueChange={setCurrency}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {CURRENCY_OPTIONS.filter((c) => c.code !== 'XTR').map(
                                    (c) => (
                                        <ZoruSelectItem key={c.code} value={c.code}>
                                            {c.label}
                                        </ZoruSelectItem>
                                    ),
                                )}
                            </ZoruSelectContent>
                        </Select>
                    </Field>
                    <ToggleRow
                        label="Test mode"
                        value={testMode}
                        onChange={setTestMode}
                    />
                </div>
                <ZoruSheetFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={busy}>
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Save
                    </Button>
                </ZoruSheetFooter>
            </ZoruSheetContent>
        </Sheet>
    );
}
