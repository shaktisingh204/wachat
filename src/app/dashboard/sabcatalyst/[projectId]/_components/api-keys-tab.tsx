'use client';

/** API Keys tab — list + create (secret shown once) + revoke. */
import React from 'react';

import {
    createSabcatalystApiKey,
    revokeSabcatalystApiKey,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    EmptyState,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Badge,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui/compat';
import type { SabcatalystApiKey, ApiKeyScope } from '@/lib/rust-client/sabcatalyst-api-keys';

const SCOPES: ApiKeyScope[] = ['read', 'write', 'admin'];

interface Props { projectId: string; initialKeys: SabcatalystApiKey[] }

export function ApiKeysTab({ projectId, initialKeys }: Props) {
    const [keys, setKeys] = React.useState(initialKeys);
    const [open, setOpen] = React.useState(false);
    const [label, setLabel] = React.useState('');
    const [scope, setScope] = React.useState<ApiKeyScope>('write');
    const [busy, setBusy] = React.useState(false);
    const [reveal, setReveal] = React.useState<string | null>(null);
    const [err, setErr] = React.useState<string | null>(null);

    async function create() {
        setBusy(true);
        setErr(null);
        try {
            const { secret, key } = await createSabcatalystApiKey({
                projectId,
                label: label.trim(),
                scope,
            });
            setKeys((s) => [key, ...s]);
            setReveal(secret);
            setLabel('');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Failed');
        } finally {
            setBusy(false);
        }
    }

    async function revoke(id: string) {
        if (!confirm('Revoke this key?')) return;
        await revokeSabcatalystApiKey(id, projectId);
        setKeys((s) => s.map((k) => (k._id === id ? { ...k, status: 'revoked' } : k)));
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    onClick={() => {
                        setOpen(true);
                        setReveal(null);
                    }}
                >
                    + New API key
                </Button>
            </div>
            {keys.length === 0 ? (
                <EmptyState
                    title="No API keys yet"
                    description="Issue a key to authenticate calls to /api/catalyst/<slug>/…"
                />
            ) : (
                <div className="space-y-2">
                    {keys.map((k) => (
                        <Card key={k._id} className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold truncate">{k.label}</h3>
                                    <Badge variant="outline">{k.scope}</Badge>
                                    <Badge variant={k.status === 'active' ? 'default' : 'destructive'}>
                                        {k.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-[var(--zoru-muted-foreground)] font-mono mt-1 truncate">
                                    hash: {k.keyHash.slice(0, 12)}…
                                </p>
                            </div>
                            {k.status === 'active' ? (
                                <Button variant="destructive" onClick={() => revoke(k._id)}>
                                    Revoke
                                </Button>
                            ) : null}
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{reveal ? 'API key created' : 'New API key'}</DialogTitle>
                    </DialogHeader>
                    {reveal ? (
                        <div className="space-y-4">
                            <p className="text-sm">
                                Copy this secret now — it will not be shown again.
                            </p>
                            <code className="block bg-[var(--zoru-muted)] p-3 rounded text-sm break-all font-mono">
                                {reveal}
                            </code>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="label">Label</Label>
                                <Input
                                    id="label"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="prod-server"
                                />
                            </div>
                            <div>
                                <Label>Scope</Label>
                                <Select value={scope} onValueChange={(v) => setScope(v as ApiKeyScope)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {err ? <p className="text-sm text-[var(--st-text)]">{err}</p> : null}
                        </div>
                    )}
                    <DialogFooter>
                        {reveal ? (
                            <Button onClick={() => { setOpen(false); setReveal(null); }}>Done</Button>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                                    Cancel
                                </Button>
                                <Button onClick={create} disabled={busy || !label.trim()}>
                                    {busy ? 'Creating…' : 'Create'}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
