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

export function TemplatesSection({
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


export function TemplateDrawer({
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


export function SendInvoiceDialog({
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


