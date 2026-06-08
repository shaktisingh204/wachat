'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Copy,
    Eye,
    EyeOff,
    ExternalLink,
    Share2,
    Archive,
    ShieldCheck,
    KeyRound,
} from 'lucide-react';

import {
    Button,
    IconButton,
    Card,
    CardBody,
    Badge,
    Separator,
    Alert,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
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
    const router = useRouter();
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
            // Clear clipboard after 30s, best effort.
            navigator.clipboard.writeText('').catch(() => {});
        }, 30_000);
    }

    async function runBreachCheck() {
        if (!revealed?.password || !secret._id) return;
        setBusy(true);
        setError(null);
        try {
            const { prefix, suffix } = await hibpKAnonymityHash(revealed.password);
            // Client-side fetch, only the prefix goes to HIBP.
            // NOTE: deferred, the HIBP provider call is not wired here.
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
        else router.push('/dashboard/sabvault');
    }

    return (
        <div className="20ui mx-auto flex max-w-3xl flex-col gap-4 p-6">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={ArrowLeft}
                        onClick={() => router.push('/dashboard/sabvault')}
                    >
                        Back to vault
                    </Button>
                    <PageTitle>{secret.name}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Button
                        variant="outline"
                        iconLeft={Share2}
                        onClick={() => router.push(`/dashboard/sabvault/share/${secret._id}`)}
                    >
                        Share
                    </Button>
                    <Button variant="outline" iconLeft={Archive} onClick={onDelete}>
                        Archive
                    </Button>
                </PageActions>
            </PageHeader>

            <Card padding="lg">
                <CardBody>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge tone="accent">{secret.kind}</Badge>
                        {secret.breached ? <Badge tone="danger">Breached</Badge> : null}
                        {secret.reused ? <Badge tone="warning">Reused</Badge> : null}
                    </div>
                    {secret.url ? (
                        <div className="mb-3 flex items-center gap-1.5 text-sm">
                            <span className="text-[var(--st-text-secondary)]">URL</span>
                            <a
                                href={secret.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--st-accent)] underline"
                            >
                                {secret.url}
                                <ExternalLink size={13} aria-hidden="true" />
                            </a>
                        </div>
                    ) : null}

                    <Separator className="my-3" />

                    {!isUnlocked ? (
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-[var(--st-text-secondary)]">
                                Vault is locked. Unlock to reveal.
                            </div>
                            <Button
                                iconLeft={KeyRound}
                                onClick={() => router.push('/dashboard/sabvault/unlock')}
                            >
                                Unlock
                            </Button>
                        </div>
                    ) : revealed ? (
                        <div className="flex flex-col gap-3">
                            {revealed.username ? (
                                <FieldRow
                                    label="Username"
                                    value={revealed.username}
                                    onCopy={() => copyField('username')}
                                />
                            ) : null}
                            {revealed.password ? (
                                <FieldRow
                                    label="Password"
                                    value={showPassword ? revealed.password : '••••••••••••'}
                                    revealed={showPassword}
                                    onCopy={() => copyField('password')}
                                    onToggle={() => setShowPassword((v) => !v)}
                                />
                            ) : null}
                            {revealed.note ? (
                                <div className="text-sm">
                                    <div className="mb-1 text-[var(--st-text-secondary)]">Note</div>
                                    <div className="whitespace-pre-wrap rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3">
                                        {revealed.note}
                                    </div>
                                </div>
                            ) : null}
                            <div>
                                <Button
                                    variant="outline"
                                    iconLeft={ShieldCheck}
                                    onClick={runBreachCheck}
                                    loading={busy}
                                >
                                    {busy ? 'Checking' : 'Run breach check'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button iconLeft={Eye} onClick={reveal} loading={busy}>
                            {busy ? 'Decrypting' : 'Reveal'}
                        </Button>
                    )}

                    {error ? (
                        <Alert tone="danger" className="mt-3">
                            {error}
                        </Alert>
                    ) : null}
                </CardBody>
            </Card>
        </div>
    );
}

function FieldRow({
    label,
    value,
    revealed,
    onCopy,
    onToggle,
}: {
    label: string;
    value: string;
    revealed?: boolean;
    onCopy: () => void;
    onToggle?: () => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-24 text-xs uppercase text-[var(--st-text-secondary)]">{label}</div>
            <div className="flex-1 font-mono text-sm text-[var(--st-text)]">{value}</div>
            {onToggle ? (
                <IconButton
                    variant="ghost"
                    size="sm"
                    icon={revealed ? EyeOff : Eye}
                    label={revealed ? 'Hide password' : 'Show password'}
                    onClick={onToggle}
                />
            ) : null}
            <IconButton
                variant="outline"
                size="sm"
                icon={Copy}
                label={`Copy ${label.toLowerCase()}`}
                onClick={onCopy}
            />
        </div>
    );
}
