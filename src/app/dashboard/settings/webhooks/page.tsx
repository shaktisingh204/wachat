'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, PageDescription, PageHeader, PageHeading, PageTitle, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState } from 'react';
import { Check,
  CircleAlert,
  Copy,
  Plus,
  Trash2,
  Webhook } from 'lucide-react';

import { useT } from '@/lib/i18n/client';

type WebhookRow = {
    id: string;
    url: string;
    events: string[];
    active: boolean;
    secret: string;
    createdAt: string;
};

const STORAGE_KEY = 'settings_webhooks_v1';
const ALL_EVENTS = [
    'message.received',
    'message.delivered',
    'campaign.completed',
    'contact.created',
    'invoice.paid',
    'team.member.joined',
];

export default function WebhooksPage() {
    const { t } = useT();
    const [rows, setRows] = useState<WebhookRow[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            setRows(raw ? JSON.parse(raw) : []);
        } catch { /* ignore */ }
    }, []);

    const persist = (next: WebhookRow[]) => {
        setRows(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const addRow = (row: WebhookRow) => persist([row, ...rows]);
    const removeRow = (id: string) => persist(rows.filter((r) => r.id !== id));
    const toggle = (id: string) =>
        persist(rows.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('settings.webhooks.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <PageHeading>
                        <PageTitle>{t('settings.webhooks.title')}</PageTitle>
                        <PageDescription>
                            {t('settings.webhooks.subtitle')}
                        </PageDescription>
                    </PageHeading>
                </PageHeader>
                <AddWebhookDialog onAdd={addRow} />
            </div>

            {rows.length === 0 ? (
                <Card className="p-6 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                        <Webhook className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-[var(--st-text)]">{t('settings.webhooks.empty.title')}</p>
                    <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                        {t('settings.webhooks.empty.description')}
                    </p>
                </Card>
            ) : (
                <Card className="p-0">
                    <ul className="divide-y divide-[var(--st-border)]">
                        {rows.map((w) => (
                            <WebhookRowItem
                                key={w.id}
                                row={w}
                                onToggle={() => toggle(w.id)}
                                onRemove={() => removeRow(w.id)}
                            />
                        ))}
                    </ul>
                </Card>
            )}

            <Card className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <CircleAlert className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-[var(--st-text)]">{t('settings.webhooks.verify.title')}</p>
                        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            {t('settings.webhooks.verify.before')}
                            <code className="mx-1 rounded bg-[var(--st-bg-muted)] px-1">X-SabNode-Signature</code>
                            {t('settings.webhooks.verify.after')}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function AddWebhookDialog({ onAdd }: { onAdd: (row: WebhookRow) => void }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(['message.received']));
    const { toast } = useToast();

    const handleSave = () => {
        if (!/^https:\/\//.test(url)) {
            toast({ title: t('settings.webhooks.toast.urlInvalid'), variant: 'destructive' });
            return;
        }
        if (selected.size === 0) {
            toast({ title: t('settings.webhooks.toast.pickEvent'), variant: 'destructive' });
            return;
        }
        onAdd({
            id: crypto.randomUUID(),
            url,
            events: Array.from(selected),
            active: true,
            secret: crypto.randomUUID().replace(/-/g, ''),
            createdAt: new Date().toISOString(),
        });
        setUrl('');
        setSelected(new Set(['message.received']));
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="h-4 w-4" />
                    {t('settings.webhooks.addWebhook')}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('settings.webhooks.dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('settings.webhooks.dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label className="mb-1.5 block text-xs">
                            {t('settings.webhooks.dialog.endpointUrl')}
                        </Label>
                        <Input
                            placeholder={t('settings.webhooks.dialog.endpointPlaceholder')}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-xs">{t('settings.webhooks.dialog.events')}</Label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_EVENTS.map((ev) => {
                                const on = selected.has(ev);
                                return (
                                    <button
                                        key={ev}
                                        type="button"
                                        onClick={() => {
                                            const next = new Set(selected);
                                            if (on) next.delete(ev);
                                            else next.add(ev);
                                            setSelected(next);
                                        }}
                                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                            on
                                                ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]'
                                                : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
                                        }`}
                                    >
                                        {ev}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        {t('action.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        {t('action.create')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function WebhookRowItem({
    row,
    onToggle,
    onRemove,
}: {
    row: WebhookRow;
    onToggle: () => void;
    onRemove: () => void;
}) {
    const { t } = useT();
    const [copied, setCopied] = useState(false);

    const copySecret = () => {
        navigator.clipboard.writeText(row.secret).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-[var(--st-text)]">{row.url}</p>
                    {row.active ? (
                        <Badge variant="success">{t('settings.webhooks.status.active')}</Badge>
                    ) : (
                        <Badge variant="ghost">{t('settings.webhooks.status.paused')}</Badge>
                    )}
                </div>
                <p className="mt-1 truncate text-xs text-[var(--st-text-secondary)]">
                    {row.events.join(', ')} · {t('settings.webhooks.row.secret')}{' '}
                    <code className="rounded bg-[var(--st-bg-muted)] px-1">{row.secret.slice(0, 8)}…</code>
                </p>
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? t('settings.webhooks.row.copied') : t('settings.webhooks.row.copySecret')}
                </Button>
                <Button variant="ghost" size="sm" onClick={onToggle}>
                    {row.active ? t('settings.webhooks.row.pause') : t('settings.webhooks.row.resume')}
                </Button>
                <Button variant="ghost" size="sm" onClick={onRemove}>
                    <Trash2 className="h-4 w-4" />
                    {t('settings.webhooks.row.remove')}
                </Button>
            </div>
        </li>
    );
}
