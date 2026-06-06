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
} from '@/components/sabcrm/20ui/compat';
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

export function InvoicesSection({
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
                                <div className="py-10 text-center text-sm text-[var(--st-text-secondary)]">
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


