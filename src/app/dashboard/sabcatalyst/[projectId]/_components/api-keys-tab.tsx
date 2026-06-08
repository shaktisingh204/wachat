'use client';

/** API Keys tab — list + create (secret shown once) + revoke. */
import React from 'react';
import { KeyRound, Plus, ShieldOff } from 'lucide-react';

import {
    createSabcatalystApiKey,
    revokeSabcatalystApiKey,
} from '@/app/actions/sabcatalyst.actions';
import {
    Alert,
    Badge,
    Button,
    Callout,
    Card,
    CardBody,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    EmptyState,
    Field,
    Input,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui';
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
            setErr(e instanceof Error ? e.message : 'Could not create the key.');
        } finally {
            setBusy(false);
        }
    }

    async function revoke(id: string) {
        if (!confirm('Revoke this key? Calls using it will stop working.')) return;
        await revokeSabcatalystApiKey(id, projectId);
        setKeys((s) => s.map((k) => (k._id === id ? { ...k, status: 'revoked' } : k)));
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    variant="primary"
                    iconLeft={Plus}
                    onClick={() => {
                        setOpen(true);
                        setReveal(null);
                    }}
                >
                    New API key
                </Button>
            </div>
            {keys.length === 0 ? (
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={KeyRound}
                            title="No API keys yet"
                            description="Issue a key to authenticate calls to /api/catalyst/<slug>/…"
                            action={
                                <Button
                                    variant="primary"
                                    iconLeft={Plus}
                                    onClick={() => {
                                        setOpen(true);
                                        setReveal(null);
                                    }}
                                >
                                    New API key
                                </Button>
                            }
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                    {keys.map((k) => (
                        <li key={k._id}>
                            <Card>
                                <CardBody className="flex items-center justify-between gap-4 p-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="flex items-center gap-2 truncate font-medium">
                                                <KeyRound size={14} aria-hidden="true" />
                                                {k.label}
                                            </h3>
                                            <Badge tone="neutral">{k.scope}</Badge>
                                            <Badge tone={k.status === 'active' ? 'success' : 'danger'}>
                                                {k.status}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 truncate font-mono text-xs text-[var(--st-text-secondary)]">
                                            hash: {k.keyHash.slice(0, 12)}…
                                        </p>
                                    </div>
                                    {k.status === 'active' ? (
                                        <Button
                                            variant="ghost"
                                            iconLeft={ShieldOff}
                                            onClick={() => revoke(k._id)}
                                            aria-label={`Revoke ${k.label}`}
                                        >
                                            Revoke
                                        </Button>
                                    ) : null}
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{reveal ? 'API key created' : 'New API key'}</DialogTitle>
                    </DialogHeader>
                    {reveal ? (
                        <div className="space-y-3">
                            <Callout tone="warning" title="Copy this secret now">
                                It will not be shown again.
                            </Callout>
                            <code className="block break-all rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3 font-mono text-sm">
                                {reveal}
                            </code>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Field label="Label" required>
                                <Input
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="prod-server"
                                    autoFocus
                                />
                            </Field>
                            <Field label="Scope">
                                <Select value={scope} onValueChange={(v) => setScope(v as ApiKeyScope)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </Field>
                            {err ? (
                                <Alert tone="danger" title="Could not create key">
                                    {err}
                                </Alert>
                            ) : null}
                        </div>
                    )}
                    <DialogFooter>
                        {reveal ? (
                            <Button variant="primary" onClick={() => { setOpen(false); setReveal(null); }}>
                                Done
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={create}
                                    loading={busy}
                                    disabled={busy || !label.trim()}
                                >
                                    Create key
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
