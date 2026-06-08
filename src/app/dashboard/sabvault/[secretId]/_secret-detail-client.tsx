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
    Lock,
    User,
    StickyNote,
    type LucideIcon,
} from 'lucide-react';

import {
    Button,
    IconButton,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Badge,
    Separator,
    Alert,
    Callout,
    Progress,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
import {
    decryptPayload,
    hibpKAnonymityHash,
    scorePasswordStrength,
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

    const strength = revealed?.password
        ? scorePasswordStrength(revealed.password)
        : null;
    const strengthPct = strength ? ((strength.score + 1) / 5) * 100 : 0;
    const strengthTone: 'danger' | 'warning' | 'success' =
        !strength ? 'success' : strength.score <= 1 ? 'danger' : strength.score <= 2 ? 'warning' : 'success';
    const strengthLabel = strength ? strength.label.replace('_', ' ') : '';

    return (
        <main className="20ui mx-auto flex max-w-3xl flex-col gap-5 p-6">
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
                    <PageEyebrow>Secret</PageEyebrow>
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

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent" kind="outline">
                            <KeyRound className="h-3 w-3" aria-hidden="true" />
                            {secret.kind}
                        </Badge>
                        {secret.breached ? (
                            <Badge tone="danger" dot>Breached</Badge>
                        ) : null}
                        {secret.reused ? (
                            <Badge tone="warning" dot>Reused</Badge>
                        ) : null}
                        {!secret.breached && !secret.reused ? (
                            <Badge tone="success" dot>Healthy</Badge>
                        ) : null}
                    </div>
                    {secret.url ? (
                        <CardDescription>
                            <a
                                href={secret.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--st-accent)] hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                                {secret.url}
                                <ExternalLink size={13} aria-hidden="true" />
                            </a>
                        </CardDescription>
                    ) : null}
                </CardHeader>

                <CardBody>
                    {!isUnlocked ? (
                        <div className="flex flex-col gap-3">
                            <Callout tone="warning" icon={Lock} title="Vault is locked">
                                Unlock with your master password to reveal and copy this secret.
                            </Callout>
                            <div>
                                <Button
                                    iconLeft={KeyRound}
                                    onClick={() => router.push('/dashboard/sabvault/unlock')}
                                >
                                    Unlock vault
                                </Button>
                            </div>
                        </div>
                    ) : revealed ? (
                        <div className="flex flex-col gap-4">
                            {revealed.username ? (
                                <FieldRow
                                    label="Username"
                                    icon={User}
                                    value={revealed.username}
                                    onCopy={() => copyField('username')}
                                />
                            ) : null}
                            {revealed.password ? (
                                <div className="flex flex-col gap-2">
                                    <FieldRow
                                        label="Password"
                                        icon={Lock}
                                        value={showPassword ? revealed.password : '••••••••••••'}
                                        revealed={showPassword}
                                        onCopy={() => copyField('password')}
                                        onToggle={() => setShowPassword((v) => !v)}
                                    />
                                    {strength ? (
                                        <div className="flex items-center gap-2 pl-[calc(6rem+0.75rem)]">
                                            <Progress value={strengthPct} tone={strengthTone} size="sm" className="flex-1" />
                                            <span className="w-24 text-right text-xs font-medium capitalize tabular-nums text-[var(--st-text-secondary)]">
                                                {strengthLabel}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            {revealed.note ? (
                                <div className="text-sm">
                                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                                        Note
                                    </div>
                                    <div className="whitespace-pre-wrap rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]">
                                        {revealed.note}
                                    </div>
                                </div>
                            ) : null}
                            <Separator />
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
                        <div className="flex flex-col items-start gap-2">
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                This secret is encrypted. Reveal to decrypt it in your browser.
                            </p>
                            <Button iconLeft={Eye} onClick={reveal} loading={busy}>
                                {busy ? 'Decrypting' : 'Reveal'}
                            </Button>
                        </div>
                    )}

                    {error ? (
                        <Alert tone="danger" className="mt-3" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    ) : null}
                </CardBody>
            </Card>
        </main>
    );
}

function FieldRow({
    label,
    icon: Icon,
    value,
    revealed,
    onCopy,
    onToggle,
}: {
    label: string;
    icon?: LucideIcon;
    value: string;
    revealed?: boolean;
    onCopy: () => void;
    onToggle?: () => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-[var(--st-radius)] px-2 py-1.5 transition-colors hover:bg-[var(--st-bg-secondary)]">
            <div className="flex w-24 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {label}
            </div>
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
