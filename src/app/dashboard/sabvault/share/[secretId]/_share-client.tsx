'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge } from '@/components/sabcrm/20ui/compat';
import {
    revokeSabvaultShare,
    shareSabvaultSecret,
} from '@/app/actions/sabvault.actions';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';
import type {
    SabvaultGranteeType,
    SabvaultShareDoc,
    SabvaultSharePermission,
} from '@/lib/rust-client/sabvault-shares';

export function ShareDialogClient({
    secret,
    initialShares,
}: {
    secret: SabvaultSecretDoc;
    initialShares: SabvaultShareDoc[];
}) {
    const router = useRouter();
    const [granteeType, setGranteeType] = React.useState<SabvaultGranteeType>('user');
    const [granteeId, setGranteeId] = React.useState('');
    const [permission, setPermission] = React.useState<SabvaultSharePermission>('read');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (!secret._id) return;
            const out = await shareSabvaultSecret({
                secretId: secret._id,
                granteeType,
                granteeId: granteeId.trim(),
                permission,
            });
            if (out.error) {
                setError(out.error);
                return;
            }
            setGranteeId('');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Share failed');
        } finally {
            setBusy(false);
        }
    }

    async function onRevoke(shareId?: string) {
        if (!shareId) return;
        const out = await revokeSabvaultShare(shareId);
        if (out.error) setError(out.error);
        else router.refresh();
    }

    return (
        <div className="zoruui mx-auto flex max-w-2xl flex-col gap-4 p-6">
            <Link href={`/dashboard/sabvault/${secret._id}`} className="text-sm text-[var(--st-text-secondary)]">
                ← Back to secret
            </Link>
            <Card className="p-5">
                <h1 className="mb-1 text-lg font-semibold">Share {secret.name}</h1>
                <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
                    Grant a teammate or team access. The grantee unlocks with their own master key.
                </p>
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <Label>Grantee</Label>
                            <Select value={granteeType} onValueChange={(v) => setGranteeType(v as SabvaultGranteeType)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="team">Team</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                            <Label htmlFor="sv-grantee-id">User/Team ID</Label>
                            <Input
                                id="sv-grantee-id"
                                required
                                value={granteeId}
                                onChange={(e) => setGranteeId(e.target.value)}
                                placeholder="ObjectId"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Permission</Label>
                        <Select value={permission} onValueChange={(v) => setPermission(v as SabvaultSharePermission)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Permission" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="read">Read (reveal/copy)</SelectItem>
                                <SelectItem value="use">Use (auto-fill only)</SelectItem>
                                <SelectItem value="edit">Edit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {error ? <div className="text-sm text-[var(--st-danger)]">{error}</div> : null}
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Granting…' : 'Grant access'}
                    </Button>
                </form>
            </Card>

            <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">Active grants</h2>
                {initialShares.length === 0 ? (
                    <div className="text-sm text-[var(--st-text-secondary)]">No active shares.</div>
                ) : (
                    <ul className="divide-y">
                        {initialShares.map((s) => (
                            <li key={s._id} className="flex items-center justify-between py-2">
                                <div>
                                    <div className="text-sm font-medium">
                                        {s.granteeType}: <span className="font-mono">{s.granteeId}</span>
                                    </div>
                                    <div className="text-xs text-[var(--st-text-secondary)]">
                                        Granted {new Date(s.grantedAt).toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge>{s.permission}</Badge>
                                    <Button variant="outline" size="sm" onClick={() => onRevoke(s._id)}>
                                        Revoke
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
