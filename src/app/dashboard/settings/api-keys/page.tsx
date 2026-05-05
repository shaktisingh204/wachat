'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, Copy, Key, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruAlertDialogTrigger,
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
    ZoruSkeleton,
    useZoruToast,
} from '@/components/zoruui';
import {
    generateApiKey,
    getApiKeysForUser,
    revokeApiKey,
} from '@/app/actions/api-keys.actions';
import type { ApiKey } from '@/lib/definitions';

type KeyRow = Omit<ApiKey, 'key'> & { _id: string };

export default function ApiKeysPage() {
    const [keys, setKeys] = useState<KeyRow[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await getApiKeysForUser();
            setKeys(data as unknown as KeyRow[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const activeCount = keys.filter((k) => !k.revoked).length;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">Settings</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>API Keys</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>API keys</ZoruPageTitle>
                        <ZoruPageDescription>
                            Use these keys to authenticate programmatic access to SabNode APIs.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>
                <CreateKeyDialog onCreated={refresh} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total keys" value={keys.length} />
                <StatCard label="Active" value={activeCount} tone="green" />
                <StatCard label="Revoked" value={keys.length - activeCount} tone="red" />
            </div>

            <ZoruCard className="p-0">
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <ZoruSkeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : keys.length === 0 ? (
                    <EmptyState onCreated={refresh} />
                ) : (
                    <ul className="divide-y divide-zoru-line">
                        {keys.map((k) => (
                            <KeyRowItem key={k._id} row={k} onRevoked={refresh} />
                        ))}
                    </ul>
                )}
            </ZoruCard>

            <ZoruCard className="p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink">
                        <Key className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-sm text-zoru-ink">Using your API key</p>
                        <p className="mt-1 text-xs text-zoru-ink-muted">
                            Include the key in the <code className="rounded bg-zoru-surface-2 px-1">X-Api-Key</code> request
                            header. Keys scope to your workspace — never expose them client-side.
                        </p>
                    </div>
                </div>
            </ZoruCard>
        </div>
    );
}

function CreateKeyDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleCreate = () => {
        if (!name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const res = await generateApiKey(name.trim());
            if (res.success && res.apiKey) {
                setNewKey(res.apiKey);
                onCreated();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const copy = () => {
        if (!newKey) return;
        navigator.clipboard.writeText(newKey).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <ZoruDialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) {
                    setName('');
                    setNewKey(null);
                    setCopied(false);
                }
            }}
        >
            <ZoruDialogTrigger asChild>
                <ZoruButton size="sm">
                    <Plus className="h-4 w-4" />
                    New API key
                </ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>{newKey ? 'Key generated' : 'Generate API key'}</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        {newKey
                            ? 'Copy the key now — you won’t see it again.'
                            : 'Give the key a descriptive name so you can identify it later.'}
                    </ZoruDialogDescription>
                </ZoruDialogHeader>

                {newKey ? (
                    <div className="py-2">
                        <ZoruLabel className="mb-1.5 block text-xs">
                            Your new API key
                        </ZoruLabel>
                        <ZoruInput
                            readOnly
                            value={newKey}
                            trailingSlot={
                                <button
                                    type="button"
                                    onClick={copy}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zoru-ink-muted hover:text-zoru-ink"
                                >
                                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <div className="py-2">
                        <ZoruLabel className="mb-1.5 block text-xs">Key name</ZoruLabel>
                        <ZoruInput
                            placeholder="e.g. Production backend"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                )}

                <ZoruDialogFooter>
                    {newKey ? (
                        <ZoruButton size="sm" onClick={() => setOpen(false)}>
                            Done
                        </ZoruButton>
                    ) : (
                        <>
                            <ZoruButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                Cancel
                            </ZoruButton>
                            <ZoruButton
                                size="sm"
                                onClick={handleCreate}
                                disabled={pending}
                            >
                                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                Generate
                            </ZoruButton>
                        </>
                    )}
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function KeyRowItem({ row, onRevoked }: { row: KeyRow; onRevoked: () => void }) {
    const [pending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const handleRevoke = () => {
        startTransition(async () => {
            const res = await revokeApiKey(row._id.toString());
            if (res.success) {
                toast({ title: 'Key revoked' });
                onRevoked();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-zoru-ink">{row.name}</p>
                    {row.revoked ? (
                        <ZoruBadge variant="danger">Revoked</ZoruBadge>
                    ) : (
                        <ZoruBadge variant="success">Active</ZoruBadge>
                    )}
                </div>
                <p className="mt-1 text-xs text-zoru-ink-muted">
                    {row.requestCount.toLocaleString()} requests ·
                    {row.lastUsed ? ` last used ${formatDate(row.lastUsed)}` : ' never used'} · created{' '}
                    {formatDate(row.createdAt)}
                </p>
            </div>
            {!row.revoked && (
                <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                        <ZoruButton variant="ghost" size="sm" disabled={pending}>
                            <Trash2 className="h-4 w-4" />
                            Revoke
                        </ZoruButton>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                            <ZoruAlertDialogTitle>Revoke this API key?</ZoruAlertDialogTitle>
                            <ZoruAlertDialogDescription>
                                Any application using &ldquo;{row.name}&rdquo; will start receiving 401 responses
                                immediately. This cannot be undone.
                            </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction
                                onClick={handleRevoke}
                                className="bg-zoru-danger text-zoru-danger-foreground hover:bg-zoru-danger/90"
                            >
                                Revoke key
                            </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>
            )}
        </li>
    );
}

function EmptyState({ onCreated }: { onCreated: () => void }) {
    return (
        <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                <Key className="h-5 w-5" />
            </div>
            <p className="text-sm text-zoru-ink">No API keys yet</p>
            <p className="mt-1 text-xs text-zoru-ink-muted">
                Generate your first key to start calling the SabNode APIs.
            </p>
            <div className="mt-4 inline-flex">
                <CreateKeyDialog onCreated={onCreated} />
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    tone = 'neutral',
}: {
    label: string;
    value: number;
    tone?: 'neutral' | 'green' | 'red';
}) {
    return (
        <ZoruCard className="p-6">
            <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
                <p className="text-[26px] leading-none text-zoru-ink">{value}</p>
                {tone === 'green' && value > 0 && <ZoruBadge variant="success">In use</ZoruBadge>}
                {tone === 'red' && value > 0 && <ZoruBadge variant="danger">Revoked</ZoruBadge>}
            </div>
        </ZoruCard>
    );
}

function formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
