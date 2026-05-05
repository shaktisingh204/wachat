'use client';

import { useEffect, useState } from 'react';
import { Check, CircleAlert, Copy, Plus, Trash2, Webhook } from 'lucide-react';

import {
    ZoruBadge,
    ZoruBreadcrumb,
    ZoruBreadcrumbItem,
    ZoruBreadcrumbLink,
    ZoruBreadcrumbList,
    ZoruBreadcrumbPage,
    ZoruBreadcrumbSeparator,
    ZoruButton,
    ZoruCard,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogTrigger,
    ZoruInput,
    ZoruLabel,
    ZoruPageDescription,
    ZoruPageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    useZoruToast,
} from '@/components/zoruui';

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
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>Webhooks</ZoruPageTitle>
                        <ZoruPageDescription>
                            Deliver SabNode events to your servers as soon as they happen.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <AddWebhookDialog onAdd={addRow} />
            </div>

            {rows.length === 0 ? (
                <ZoruCard className="p-6 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                        <Webhook className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-zoru-ink">No webhooks yet</p>
                    <p className="mt-1 text-xs text-zoru-ink-muted">
                        Add your first endpoint to start receiving event callbacks.
                    </p>
                </ZoruCard>
            ) : (
                <ZoruCard className="p-0">
                    <ul className="divide-y divide-zoru-line">
                        {rows.map((w) => (
                            <WebhookRowItem
                                key={w.id}
                                row={w}
                                onToggle={() => toggle(w.id)}
                                onRemove={() => removeRow(w.id)}
                            />
                        ))}
                    </ul>
                </ZoruCard>
            )}

            <ZoruCard className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <CircleAlert className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-zoru-ink">Verifying the signature</p>
                        <p className="mt-1 text-xs text-zoru-ink-muted">
                            Every request is signed with your webhook secret in the
                            <code className="mx-1 rounded bg-zoru-surface-2 px-1">X-SabNode-Signature</code>
                            header. HMAC-SHA256 over the raw body.
                        </p>
                    </div>
                </div>
            </ZoruCard>
        </div>
    );
}

function AddWebhookDialog({ onAdd }: { onAdd: (row: WebhookRow) => void }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(['message.received']));
    const { toast } = useZoruToast();

    const handleSave = () => {
        if (!/^https:\/\//.test(url)) {
            toast({ title: 'URL must start with https://', variant: 'destructive' });
            return;
        }
        if (selected.size === 0) {
            toast({ title: 'Pick at least one event', variant: 'destructive' });
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
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton size="sm">
                    <Plus className="h-4 w-4" />
                    Add webhook
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Add webhook endpoint</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Pick which events to deliver and where to send them.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <ZoruLabel className="mb-1.5 block text-xs">
                            Endpoint URL
                        </ZoruLabel>
                        <ZoruInput
                            placeholder="https://example.com/webhooks/sabnode"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                    <div>
                        <ZoruLabel className="mb-1.5 block text-xs">Events</ZoruLabel>
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
                                                ? 'border-zoru-ink bg-zoru-ink text-zoru-bg'
                                                : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink'
                                        }`}
                                    >
                                        {ev}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={handleSave}>
                        Create
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
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
                    <p className="truncate text-sm text-zoru-ink">{row.url}</p>
                    {row.active ? (
                        <ZoruBadge variant="success">Active</ZoruBadge>
                    ) : (
                        <ZoruBadge variant="ghost">Paused</ZoruBadge>
                    )}
                </div>
                <p className="mt-1 truncate text-xs text-zoru-ink-muted">
                    {row.events.join(', ')} · secret{' '}
                    <code className="rounded bg-zoru-surface-2 px-1">{row.secret.slice(0, 8)}…</code>
                </p>
            </div>
            <div className="flex gap-2">
                <ZoruButton variant="ghost" size="sm" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy secret'}
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" onClick={onToggle}>
                    {row.active ? 'Pause' : 'Resume'}
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" onClick={onRemove}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                </ZoruButton>
            </div>
        </li>
    );
}
