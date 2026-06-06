'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

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
} from '@/components/sabcrm/20ui';
import {
    base64ToBytes,
    bytesToBase64,
    deriveMasterKey,
    makeCanary,
    newSalt,
    SABVAULT_CRYPTO_PARAMS,
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

    return (
        <div className="ui20 mx-auto flex max-w-md flex-col gap-4 p-6">
            <Card padding="lg">
                <CardHeader>
                    <CardTitle>{isSetup ? 'Set up your SabVault' : 'Unlock SabVault'}</CardTitle>
                    <CardDescription>
                        {isSetup
                            ? 'Your master password derives the encryption key in this browser. It is never sent to our servers, losing it means losing access.'
                            : 'Enter your master password. The key stays in this tab only and locks after 15 minutes of inactivity.'}
                    </CardDescription>
                </CardHeader>

                <CardBody>
                    <form className="flex flex-col gap-3" onSubmit={isSetup ? onSetup : onUnlock}>
                        <Field id="sv-master" label="Master password" required>
                            <Input
                                type="password"
                                required
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={isSetup ? 'new-password' : 'current-password'}
                            />
                        </Field>
                        {isSetup ? (
                            <Field id="sv-confirm" label="Confirm" required>
                                <Input
                                    type="password"
                                    required
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    autoComplete="new-password"
                                />
                            </Field>
                        ) : null}
                        {error ? (
                            <Alert tone="danger" onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        ) : null}
                        <Button type="submit" variant="primary" loading={busy}>
                            {isSetup ? 'Create vault' : 'Unlock'}
                        </Button>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
