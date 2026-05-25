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

export function ProvidersSection({
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


export function ProviderDrawer({
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


