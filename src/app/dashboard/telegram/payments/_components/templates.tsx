'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    IconButton,
    Input,
    Label,
    SegmentedControl,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2, Pencil, Send, Link2 } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';

/**
 * Telegram Payments dashboard. Multi-tenant, project-scoped.
 *
 * Surface (segmented views, per no-tab-UI directive):
 *   - Payments   list, analytics chart, filters, CSV export, refund
 *   - Invoices   sent invoices and invoice links from this project
 *   - Templates  reusable invoice payloads (CRUD via drawer)
 *   - Providers  saved provider tokens (CRUD plus token-validity test)
 *
 * Data flows through the server actions in
 * `@/app/actions/telegram-payments.actions.ts`, which proxy to the
 * `telegram-payments` Rust BFF.
 */

import * as React from 'react';

import {
    createPaymentInvoiceLinkAction,
    createPaymentTemplateAction,
    deletePaymentTemplateAction,
    sendPaymentInvoiceAction,
    updatePaymentTemplateAction,
    type BotOption,
    type ProviderRow,
    type TemplateRow,
} from '@/app/actions/telegram-payments.actions';
import type {
    PriceItem,
    UpsertTemplateBody,
} from '@/lib/rust-client/telegram-payments';

import { fmtCurrency, Field, ToggleRow } from './shared';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = [
    { code: 'XTR', label: 'XTR, Telegram Stars' },
    { code: 'USD', label: 'USD' },
    { code: 'EUR', label: 'EUR' },
    { code: 'GBP', label: 'GBP' },
    { code: 'INR', label: 'INR' },
    { code: 'AUD', label: 'AUD' },
    { code: 'CAD', label: 'CAD' },
];

const SEND_MODES = [
    { value: 'send' as const, label: 'Send to chat', icon: Send },
    { value: 'link' as const, label: 'Invoice link', icon: Link2 },
];

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
    const { toast } = useToast();
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
                    variant="primary"
                    iconLeft={Plus}
                    onClick={() => setDrawer({ open: true, editing: null })}
                >
                    New template
                </Button>
            </div>
            <Card className="overflow-hidden">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Name</Th>
                            <Th>Title</Th>
                            <Th>Currency</Th>
                            <Th>Amount</Th>
                            <Th className="text-right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {templates.length === 0 && (
                            <Tr>
                                <Td colSpan={5}>
                                    <div className="py-10 text-center text-sm text-[var(--st-text-secondary)]">
                                        No templates yet. Create one to send invoices.
                                    </div>
                                </Td>
                            </Tr>
                        )}
                        {templates.map((t) => {
                            const total = t.prices.reduce(
                                (sum, p) => sum + p.amountCents,
                                0,
                            );
                            return (
                                <Tr key={t._id}>
                                    <Td>{t.name}</Td>
                                    <Td>{t.title}</Td>
                                    <Td>{t.currency}</Td>
                                    <Td>
                                        {fmtCurrency(total, t.currency)}
                                    </Td>
                                    <Td className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <IconButton
                                                size="sm"
                                                variant="ghost"
                                                icon={Send}
                                                label="Send invoice"
                                                onClick={() => setSendDialog(t)}
                                            />
                                            <IconButton
                                                size="sm"
                                                variant="ghost"
                                                icon={Pencil}
                                                label="Edit template"
                                                onClick={() =>
                                                    setDrawer({ open: true, editing: t })
                                                }
                                            />
                                            <IconButton
                                                size="sm"
                                                variant="ghost"
                                                icon={Trash2}
                                                label="Delete template"
                                                onClick={() => setDeleteTarget(t)}
                                            />
                                        </div>
                                    </Td>
                                </Tr>
                            );
                        })}
                    </TBody>
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

            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(v) => !v && setDeleteTarget(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete &ldquo;{deleteTarget?.name}&rdquo;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Existing invoices and payments using this template are
                            preserved; only the template definition is removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
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
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
    const { toast } = useToast();
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
            <SheetContent className="w-full sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>
                        {editing ? 'Edit template' : 'New invoice template'}
                    </SheetTitle>
                    <SheetDescription>
                        Templates are reusable invoice payloads. The buyer-facing
                        title and description are taken from here; the payload is
                        the opaque string returned in the successful_payment update.
                    </SheetDescription>
                </SheetHeader>

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
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CURRENCY_OPTIONS.map((c) => (
                                        <SelectItem key={c.code} value={c.code}>
                                            {c.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
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
                                <SelectTrigger>
                                    <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {providers.map((p) => (
                                        <SelectItem key={p._id} value={p._id}>
                                            {p.label} ({p.currency})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
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
                    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <Label>Price lines</Label>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                iconLeft={Plus}
                                onClick={addPrice}
                            >
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
                                    <IconButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        icon={Trash2}
                                        label="Remove line"
                                        onClick={() => removePrice(i)}
                                    />
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

                <SheetFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        loading={saving}
                        disabled={saving}
                    >
                        {editing ? 'Save changes' : 'Create template'}
                    </Button>
                </SheetFooter>
            </SheetContent>
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
    const { toast } = useToast();
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send or link invoice</DialogTitle>
                    <DialogDescription>
                        Template <strong>{template.name}</strong>. Either send it
                        directly to a chat, or get a shareable invoice link.
                    </DialogDescription>
                </DialogHeader>
                <SegmentedControl
                    fullWidth
                    aria-label="Delivery mode"
                    items={SEND_MODES}
                    value={mode}
                    onChange={setMode}
                />
                <div className="flex flex-col gap-3">
                    <Field label="Bot">
                        <Select
                            value={botId}
                            onValueChange={setBotId}
                            disabled={bots.length === 0}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pick a bot" />
                            </SelectTrigger>
                            <SelectContent>
                                {bots.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        @{b.username || b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    {mode === 'send' ? (
                        <Field label="Chat ID">
                            <Input
                                placeholder="-100 prefix or numeric user id"
                                value={chatId}
                                onChange={(e) => setChatId(e.target.value)}
                            />
                        </Field>
                    ) : null}
                    {linkResult ? (
                        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-2 text-xs">
                            <div className="mb-1 text-[var(--st-text-secondary)]">Invoice link:</div>
                            <a
                                href={linkResult}
                                target="_blank"
                                rel="noreferrer"
                                className="break-all text-[var(--st-accent)] underline"
                            >
                                {linkResult}
                            </a>
                        </div>
                    ) : null}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Close
                    </Button>
                    {mode === 'send' ? (
                        <Button
                            variant="primary"
                            onClick={doSend}
                            loading={busy}
                            disabled={busy || !botId || !chatId.trim()}
                        >
                            Send invoice
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={doLink}
                            loading={busy}
                            disabled={busy}
                        >
                            Create link
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
