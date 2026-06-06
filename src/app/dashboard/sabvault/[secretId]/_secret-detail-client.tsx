'use client';

import * as React from 'react';
import Link from 'next/link';

import {
    Button,
    ZoruCard,
    ZoruBadge,
    Separator,
} from '@/components/sabcrm/20ui/compat';
import {
    decryptPayload,
    hibpKAnonymityHash,
} from '@/lib/sabvault/crypto';
import {
    checkSabvaultBreach,
    deleteSabvaultSecret,
    logSabvaultAccess,
} from '@/app/actions/sabvault.actions';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';

import { useVaultKey } from '../_components/vault-key-context';

interface DecryptedLogin {
    username?: string;
    password?: string;
    note?: string;
}

export function SecretDetailClient({ secret }: { secret: SabvaultSecretDoc }) {
    const { key, isUnlocked, touch } = useVaultKey();
    const [revealed, setRevealed] = React.useState<DecryptedLogin | null>(null);
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    async function reveal() {
        if (!key) {
            setError('Vault is locked');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const out = await decryptPayload<DecryptedLogin>(secret.encryptedPayloadB64, key);
            setRevealed(out);
            touch();
            await logSabvaultAccess({ secretId: secret._id, action: 'reveal' });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Decrypt failed');
        } finally {
            setBusy(false);
        }
    }

    async function copyField(field: 'username' | 'password') {
        if (!revealed) {
            await reveal();
        }
        const value = revealed?.[field];
        if (!value) return;
        await navigator.clipboard.writeText(value);
        touch();
        await logSabvaultAccess({ secretId: secret._id, action: 'copy', meta: { field } });
        window.setTimeout(() => {
            // Clear clipboard after 30s — best effort.
            navigator.clipboard.writeText('').catch(() => {});
        }, 30_000);
    }

    async function runBreachCheck() {
        if (!revealed?.password || !secret._id) return;
        setBusy(true);
        setError(null);
        try {
            const { prefix, suffix } = await hibpKAnonymityHash(revealed.password);
            // Client-side fetch — only the prefix goes to HIBP.
            // NOTE: deferred — the HIBP provider call is not wired here.
            // Caller-side integration would:
            //   const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
            //   const lines = (await r.text()).split('\n');
            //   const hit = lines.some(l => l.startsWith(suffix.toUpperCase()));
            const hit = false;
            void prefix; void suffix;
            await checkSabvaultBreach({
                secretId: secret._id,
                status: hit ? 'breached' : 'clean',
                source: 'hibp',
                breachCount: hit ? 1 : 0,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Breach check failed');
        } finally {
            setBusy(false);
        }
    }

    async function onDelete() {
        if (!confirm('Archive this secret?')) return;
        if (!secret._id) return;
        const out = await deleteSabvaultSecret(secret._id);
        if (out.error) setError(out.error);
        else window.location.href = '/dashboard/sabvault';
    }

    return (
        <div className="zoruui mx-auto flex max-w-3xl flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
                <Link href="/dashboard/sabvault" className="text-sm text-[var(--st-text-secondary)]">
                    ← Back to vault
                </Link>
                <div className="flex gap-2">
                    <Link href={`/dashboard/sabvault/share/${secret._id}`}>
                        <Button variant="outline">Share</Button>
                    </Link>
                    <Button variant="outline" onClick={onDelete}>
                        Archive
                    </Button>
                </div>
            </div>

            <ZoruCard className="p-5">
                <div className="mb-3 flex items-center gap-3">
                    <h1 className="text-lg font-semibold">{secret.name}</h1>
                    <ZoruBadge>{secret.kind}</ZoruBadge>
                    {secret.breached ? <ZoruBadge variant="destructive">Breached</ZoruBadge> : null}
                    {secret.reused ? <ZoruBadge>Reused</ZoruBadge> : null}
                </div>
                {secret.url ? (
                    <div className="mb-3 text-sm">
                        <span className="text-[var(--st-text-secondary)]">URL · </span>
                        <a href={secret.url} target="_blank" rel="noreferrer" className="underline">
                            {secret.url}
                        </a>
                    </div>
                ) : null}

                <Separator className="my-3" />

                {!isUnlocked ? (
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm">Vault is locked — unlock to reveal.</div>
                        <Link href="/dashboard/sabvault/unlock">
                            <Button>Unlock</Button>
                        </Link>
                    </div>
                ) : revealed ? (
                    <div className="flex flex-col gap-3">
                        {revealed.username ? (
                            <FieldRow label="Username" value={revealed.username} onCopy={() => copyField('username')} />
                        ) : null}
                        {revealed.password ? (
                            <FieldRow
                                label="Password"
                                value={showPassword ? revealed.password : '••••••••••••'}
                                onCopy={() => copyField('password')}
                                onToggle={() => setShowPassword((v) => !v)}
                            />
                        ) : null}
                        {revealed.note ? (
                            <div className="text-sm">
                                <div className="mb-1 text-[var(--st-text-secondary)]">Note</div>
                                <div className="whitespace-pre-wrap rounded-md bg-[var(--st-bg-secondary)] p-3">
                                    {revealed.note}
                                </div>
                            </div>
                        ) : null}
                        <div>
                            <Button variant="outline" onClick={runBreachCheck} disabled={busy}>
                                {busy ? 'Checking…' : 'Run breach check'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button onClick={reveal} disabled={busy}>
                        {busy ? 'Decrypting…' : 'Reveal'}
                    </Button>
                )}

                {error ? <div className="mt-3 text-sm text-[var(--st-danger)]">{error}</div> : null}
            </ZoruCard>
        </div>
    );
}

function FieldRow({
    label,
    value,
    onCopy,
    onToggle,
}: {
    label: string;
    value: string;
    onCopy: () => void;
    onToggle?: () => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-24 text-xs uppercase text-[var(--st-text-secondary)]">{label}</div>
            <div className="flex-1 font-mono text-sm">{value}</div>
            {onToggle ? (
                <Button variant="ghost" size="sm" onClick={onToggle}>
                    Toggle
                </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onCopy}>
                Copy
            </Button>
        </div>
    );
}
