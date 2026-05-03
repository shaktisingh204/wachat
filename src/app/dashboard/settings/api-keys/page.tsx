'use client';

import { useEffect, useState, useTransition } from 'react';
import {
    LuKey,
    LuPlus,
    LuCopy,
    LuCheck,
    LuTrash2,
    LuEye,
    LuEyeOff,
    LuLoaderCircle,
} from 'react-icons/lu';

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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
    const { toast } = useToast();

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
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'API Keys' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="API keys"
                subtitle="Use these keys to authenticate programmatic access to SabNode APIs."
                actions={<CreateKeyDialog onCreated={refresh} />}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Total keys" value={keys.length} />
                <StatCard label="Active" value={activeCount} tone="green" />
                <StatCard label="Revoked" value={keys.length - activeCount} tone="red" />
            </div>

            <ClayCard padded={false}>
                {loading ? (
                    <div className="space-y-2 p-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : keys.length === 0 ? (
                    <EmptyState onCreated={refresh} />
                ) : (
                    <ul className="divide-y divide-border">
                        {keys.map((k) => (
                            <KeyRowItem key={k._id} row={k} onRevoked={refresh} />
                        ))}
                    </ul>
                )}
            </ClayCard>

            <ClayCard padded variant="soft">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-white">
                        <LuKey className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-foreground">Using your API key</p>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                            Include the key in the <code className="rounded bg-card px-1">X-Api-Key</code> request
                            header. Keys scope to your workspace — never expose them client-side.
                        </p>
                    </div>
                </div>
            </ClayCard>
        </div>
    );
}

function CreateKeyDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, startTransition] = useTransition();
    const { toast } = useToast();

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
        <Dialog
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
            <DialogTrigger asChild>
                <ClayButton variant="obsidian" size="sm" leading={<LuPlus className="h-4 w-4" />}>
                    New API key
                </ClayButton>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{newKey ? 'Key generated' : 'Generate API key'}</DialogTitle>
                    <DialogDescription>
                        {newKey
                            ? 'Copy the key now — you won\u2019t see it again.'
                            : 'Give the key a descriptive name so you can identify it later.'}
                    </DialogDescription>
                </DialogHeader>

                {newKey ? (
                    <div className="py-2">
                        <Label className="mb-1.5 block text-[12.5px] font-medium text-foreground">
                            Your new API key
                        </Label>
                        <ClayInput
                            readOnly
                            value={newKey}
                            trailing={
                                <button
                                    type="button"
                                    onClick={copy}
                                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                                >
                                    {copied ? <LuCheck className="h-3.5 w-3.5" /> : <LuCopy className="h-3.5 w-3.5" />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <div className="py-2">
                        <Label className="mb-1.5 block text-[12.5px] font-medium text-foreground">Key name</Label>
                        <ClayInput
                            placeholder="e.g. Production backend"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                )}

                <DialogFooter>
                    {newKey ? (
                        <ClayButton variant="obsidian" size="sm" onClick={() => setOpen(false)}>
                            Done
                        </ClayButton>
                    ) : (
                        <>
                            <ClayButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
                                Cancel
                            </ClayButton>
                            <ClayButton
                                variant="obsidian"
                                size="sm"
                                onClick={handleCreate}
                                disabled={pending}
                                leading={pending ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
                            >
                                Generate
                            </ClayButton>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function KeyRowItem({ row, onRevoked }: { row: KeyRow; onRevoked: () => void }) {
    const [pending, startTransition] = useTransition();
    const { toast } = useToast();

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
                    <p className="truncate text-[13.5px] font-semibold text-foreground">{row.name}</p>
                    {row.revoked ? (
                        <ClayBadge tone="red">Revoked</ClayBadge>
                    ) : (
                        <ClayBadge tone="green">Active</ClayBadge>
                    )}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                    {row.requestCount.toLocaleString()} requests ·
                    {row.lastUsed ? ` last used ${formatDate(row.lastUsed)}` : ' never used'} · created{' '}
                    {formatDate(row.createdAt)}
                </p>
            </div>
            {!row.revoked && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <ClayButton
                            variant="ghost"
                            size="sm"
                            leading={<LuTrash2 className="h-4 w-4" />}
                            disabled={pending}
                        >
                            Revoke
                        </ClayButton>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Any application using &ldquo;{row.name}&rdquo; will start receiving 401 responses
                                immediately. This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRevoke}
                                className="bg-red-600 text-white hover:bg-red-700"
                            >
                                Revoke key
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </li>
    );
}

function EmptyState({ onCreated }: { onCreated: () => void }) {
    return (
        <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                <LuKey className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">No API keys yet</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
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
        <ClayCard variant="soft" padded>
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <div className="mt-1 flex items-baseline gap-2">
                <p className="text-[26px] font-semibold leading-none text-foreground">{value}</p>
                {tone === 'green' && value > 0 && <ClayBadge tone="green">In use</ClayBadge>}
                {tone === 'red' && value > 0 && <ClayBadge tone="red">Revoked</ClayBadge>}
            </div>
        </ClayCard>
    );
}

function formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
