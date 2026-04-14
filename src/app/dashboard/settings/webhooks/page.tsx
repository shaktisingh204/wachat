'use client';

import { useEffect, useState } from 'react';
import { LuWebhook, LuPlus, LuCircleAlert, LuTrash2, LuCopy, LuCheck } from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
} from '@/components/clay';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Webhooks' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Webhooks"
                subtitle="Deliver SabNode events to your servers as soon as they happen."
                actions={<AddWebhookDialog onAdd={addRow} />}
            />

            {rows.length === 0 ? (
                <ClayCard padded className="py-10 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clay-surface-subtle text-clay-ink-muted">
                        <LuWebhook className="h-5 w-5" />
                    </div>
                    <p className="text-[13px] font-semibold text-clay-ink">No webhooks yet</p>
                    <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                        Add your first endpoint to start receiving event callbacks.
                    </p>
                </ClayCard>
            ) : (
                <ClayCard padded={false}>
                    <ul className="divide-y divide-clay-border">
                        {rows.map((w) => (
                            <WebhookRowItem
                                key={w.id}
                                row={w}
                                onToggle={() => toggle(w.id)}
                                onRemove={() => removeRow(w.id)}
                            />
                        ))}
                    </ul>
                </ClayCard>
            )}

            <ClayCard padded variant="soft" className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-obsidian text-white">
                    <LuCircleAlert className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[13px] font-semibold text-clay-ink">Verifying the signature</p>
                    <p className="mt-1 text-[12.5px] text-clay-ink-muted">
                        Every request is signed with your webhook secret in the
                        <code className="mx-1 rounded bg-clay-surface px-1">X-SabNode-Signature</code>
                        header. HMAC-SHA256 over the raw body.
                    </p>
                </div>
            </ClayCard>
        </div>
    );
}

function AddWebhookDialog({ onAdd }: { onAdd: (row: WebhookRow) => void }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set(['message.received']));
    const { toast } = useToast();

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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <ClayButton variant="obsidian" size="sm" leading={<LuPlus className="h-4 w-4" />}>
                    Add webhook
                </ClayButton>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add webhook endpoint</DialogTitle>
                    <DialogDescription>
                        Pick which events to deliver and where to send them.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <Label className="mb-1.5 block text-[12.5px] font-medium text-clay-ink">
                            Endpoint URL
                        </Label>
                        <ClayInput
                            placeholder="https://example.com/webhooks/sabnode"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5 block text-[12.5px] font-medium text-clay-ink">Events</Label>
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
                                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                                            on
                                                ? 'border-clay-obsidian bg-clay-obsidian text-white'
                                                : 'border-clay-border bg-clay-surface text-clay-ink-muted hover:text-clay-ink'
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
                    <ClayButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                    </ClayButton>
                    <ClayButton variant="obsidian" size="sm" onClick={handleSave}>
                        Create
                    </ClayButton>
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
                    <p className="truncate text-[13.5px] font-semibold text-clay-ink">{row.url}</p>
                    {row.active ? (
                        <ClayBadge tone="green">Active</ClayBadge>
                    ) : (
                        <ClayBadge tone="neutral">Paused</ClayBadge>
                    )}
                </div>
                <p className="mt-1 truncate text-[12px] text-clay-ink-muted">
                    {row.events.join(', ')} · secret{' '}
                    <code className="rounded bg-clay-surface-subtle px-1">{row.secret.slice(0, 8)}…</code>
                </p>
            </div>
            <div className="flex gap-2">
                <ClayButton
                    variant="ghost"
                    size="sm"
                    leading={copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
                    onClick={copySecret}
                >
                    {copied ? 'Copied' : 'Copy secret'}
                </ClayButton>
                <ClayButton variant="ghost" size="sm" onClick={onToggle}>
                    {row.active ? 'Pause' : 'Resume'}
                </ClayButton>
                <ClayButton
                    variant="ghost"
                    size="sm"
                    leading={<LuTrash2 className="h-4 w-4" />}
                    onClick={onRemove}
                >
                    Remove
                </ClayButton>
            </div>
        </li>
    );
}
