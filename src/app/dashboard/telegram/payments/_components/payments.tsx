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

import { fmtCurrency, fmtDate, startOfNDaysAgo, StatusBadge, ViewSwitcher, Field, ToggleRow } from './shared';

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


export function PaymentsSection(props: PaymentsSectionProps) {
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
                        <div className="text-xs text-zoru-ink-muted">
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
                        <div className="flex h-full items-center justify-center text-xs text-zoru-ink-muted">
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
                                    <div className="py-10 text-center text-sm text-zoru-ink-muted">
                                        No payments match these filters yet.
                                    </div>
                                </ZoruTableCell>
                            </ZoruTableRow>
                        )}
                        {props.payments.map((p) => (
                            <ZoruTableRow key={p._id}>
                                <ZoruTableCell>
                                    <div className="text-sm">{p.username ?? '—'}</div>
                                    <div className="text-xs text-zoru-ink-muted">
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
                    <div className="text-zoru-ink-muted">
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
                                    <pre className="max-h-40 overflow-auto rounded bg-zoru-surface-2/40 p-2 text-[11px]">
                                        {JSON.stringify(detail.orderInfo, null, 2)}
                                    </pre>
                                </div>
                            ) : null}
                            {detail.shippingAddress ? (
                                <div>
                                    <Label className="text-xs">Shipping address</Label>
                                    <pre className="max-h-40 overflow-auto rounded bg-zoru-surface-2/40 p-2 text-[11px]">
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


