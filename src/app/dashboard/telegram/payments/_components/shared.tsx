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

export function fmtCurrency(amountSmallestUnit: number, currency: string): string {
    if (currency === 'XTR') {
        return `${new Intl.NumberFormat().format(amountSmallestUnit)} XTR`;
    }
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
        }).format(amountSmallestUnit / 100);
    } catch {
        return `${(amountSmallestUnit / 100).toFixed(2)} ${currency}`;
    }
}


export function fmtDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}


export function startOfNDaysAgo(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}


export function StatusBadge({ status }: { status: string }) {
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


export function ViewSwitcher({
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


export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-xs">{label}</Label>
            {children}
        </div>
    );
}


export function ToggleRow({
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


