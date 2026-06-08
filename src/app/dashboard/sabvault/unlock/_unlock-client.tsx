'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Lock, LockKeyhole, ShieldCheck, KeyRound } from 'lucide-react';

import {
    Button,
    Input,
    Field,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Alert,
    Callout,
    Progress,
    Separator,
} from '@/components/sabcrm/20ui';
import {
    base64ToBytes,
    bytesToBase64,
    deriveMasterKey,
    makeCanary,
    newSalt,
    SABVAULT_CRYPTO_PARAMS,
    scorePasswordStrength,
    verifyCanary,
} from '@/lib/sabvault/crypto';
import {
    logSabvaultAccess,
    setupSabvaultUserKey,
    type SabvaultUserKeyRecord,
} from '@/app/actions/sabvault.actions';

import { useVaultKey } from '../_components/vault-key-context';

/**
 * Two-mode page:
 *  1. Setup, when the user has no `sabvault_user_keys` row yet. Generates
 *     a fresh salt + encrypted canary, posts both to the server. The
 *     password itself never leaves this component.
 *  2. Unlock, derives a key from the stored salt + entered password,
 *     verifies it against the stored canary, and parks the resulting
 *     CryptoKey in the in-memory provider.
 */
export function UnlockClient({ keyRecord }: { keyRecord: SabvaultUserKeyRecord | null }) {
    const router = useRouter();
    const { unlock } = useVaultKey();

    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const isSetup = keyRecord === null;

    async function onSetup(e: React.FormEvent) {
        e.preventDefault();
        if (password.length < 12) {
            setError('Use at least 12 characters');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const salt = newSalt();
            const key = await deriveMasterKey(password, salt);
            const canary = await makeCanary(key);
            const saltB64 = bytesToBase64(salt);
            const out = await setupSabvaultUserKey({
                saltB64,
                canaryB64: canary,
                pbkdf2Iterations: SABVAULT_CRYPTO_PARAMS.pbkdf2Iterations,
                algorithm: SABVAULT_CRYPTO_PARAMS.algorithm,
            });
            if (!out.ok) {
                setError(out.error ?? 'Setup failed');
                return;
            }
            unlock(key, saltB64);
            await logSabvaultAccess({ action: 'unlock_ok' });
            router.push('/dashboard/sabvault');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Setup failed');
        } finally {
            setBusy(false);
        }
    }

    async function onUnlock(e: React.FormEvent) {
        e.preventDefault();
        if (!keyRecord) return;
        setBusy(true);
        setError(null);
        try {
            const salt = base64ToBytes(keyRecord.saltB64);
            const key = await deriveMasterKey(password, salt);
            const ok = await verifyCanary(keyRecord.canaryB64, key);
            if (!ok) {
                setError('Wrong master password');
                await logSabvaultAccess({ action: 'unlock_fail' });
                return;
            }
            unlock(key, keyRecord.saltB64);
            await logSabvaultAccess({ action: 'unlock_ok' });
            router.push('/dashboard/sabvault');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unlock failed');
        } finally {
            setBusy(false);
        }
    }

    const strength = isSetup && password ? scorePasswordStrength(password) : null;
    const strengthPct = strength ? ((strength.score + 1) / 5) * 100 : 0;
    const strengthTone: 'danger' | 'warning' | 'success' =
        !strength ? 'success' : strength.score <= 1 ? 'danger' : strength.score <= 2 ? 'warning' : 'success';
    const strengthLabel = strength ? strength.label.replace('_', ' ') : '';

    return (
        <main className="20ui mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center gap-5 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
                <span
                    className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--st-radius-lg,12px)] bg-[var(--st-accent-soft,var(--st-bg-secondary))] text-[var(--st-accent)]"
                    aria-hidden="true"
                >
                    {isSetup ? <LockKeyhole className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                </span>
                <div>
                    <h1 className="text-lg font-semibold text-[var(--st-text)]">
                        {isSetup ? 'Set up your vault' : 'Unlock your vault'}
                    </h1>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--st-text-secondary)]">
                        {isSetup
                            ? 'Your master password derives the encryption key in this browser. It never reaches our servers.'
                            : 'The key stays in this tab only and re-locks after 15 minutes of inactivity.'}
                    </p>
                </div>
            </div>

            <Card padding="lg">
                <CardBody>
                    <form className="flex flex-col gap-4" onSubmit={isSetup ? onSetup : onUnlock}>
                        <Field
                            id="sv-master"
                            label="Master password"
                            required
                            help={isSetup ? 'Use at least 12 characters with a mix of types.' : undefined}
                        >
                            <Input
                                type="password"
                                required
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={isSetup ? 'new-password' : 'current-password'}
                                iconLeft={KeyRound}
                            />
                        </Field>

                        {isSetup && strength ? (
                            <div className="flex items-center gap-2">
                                <Progress value={strengthPct} tone={strengthTone} size="sm" className="flex-1" />
                                <span className="w-24 text-right text-xs font-medium capitalize tabular-nums text-[var(--st-text-secondary)]">
                                    {strengthLabel}
                                </span>
                            </div>
                        ) : null}

                        {isSetup ? (
                            <Field id="sv-confirm" label="Confirm password" required>
                                <Input
                                    type="password"
                                    required
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    autoComplete="new-password"
                                    iconLeft={KeyRound}
                                />
                            </Field>
                        ) : null}

                        {error ? (
                            <Alert tone="danger" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        ) : null}

                        <Button type="submit" variant="primary" loading={busy} iconLeft={isSetup ? LockKeyhole : Lock}>
                            {isSetup ? 'Create vault' : 'Unlock'}
                        </Button>
                    </form>

                    {isSetup ? (
                        <>
                            <Separator className="my-4" />
                            <Callout tone="info" icon={ShieldCheck} title="Zero-knowledge by design">
                                We only store a salt and an encrypted canary. If you lose this password, your secrets cannot be recovered.
                            </Callout>
                        </>
                    ) : null}
                </CardBody>
            </Card>
        </main>
    );
}
