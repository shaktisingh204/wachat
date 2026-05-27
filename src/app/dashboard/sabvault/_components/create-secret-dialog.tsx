'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Button,
    Input,
    Label,
    Textarea,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruDialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/zoruui';

import {
    encryptPayload,
    scorePasswordStrength,
} from '@/lib/sabvault/crypto';
import type { SabvaultSecretKind } from '@/lib/rust-client/sabvault-secrets';

import { useVaultKey } from './vault-key-context';
import { createSabvaultSecret, type SabvaultUserKeyRecord } from '@/app/actions/sabvault.actions';

/**
 * Create-secret dialog. Encrypts the kind-specific payload CLIENT-SIDE
 * with the unlocked vault key, then ships only the ciphertext envelope to
 * the server action.
 */
export function CreateSecretDialog({ keyRecord }: { keyRecord: SabvaultUserKeyRecord | null }) {
    const router = useRouter();
    const { key, saltB64, isUnlocked, touch } = useVaultKey();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [name, setName] = React.useState('');
    const [kind, setKind] = React.useState<SabvaultSecretKind>('login');
    const [url, setUrl] = React.useState('');
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [note, setNote] = React.useState('');

    function reset() {
        setName('');
        setUrl('');
        setUsername('');
        setPassword('');
        setNote('');
        setKind('login');
        setError(null);
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!key || !isUnlocked) {
            setError('Vault is locked');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            // Build the kind-specific cleartext payload.
            const payload: Record<string, unknown> = { note };
            if (kind === 'login') {
                payload.username = username;
                payload.password = password;
            } else if (kind === 'note') {
                payload.body = note;
            }
            // Strength is computed BEFORE encryption — we never persist cleartext.
            const strength = kind === 'login' ? scorePasswordStrength(password).label : undefined;

            const envelope = await encryptPayload(payload, key);
            touch();

            const out = await createSabvaultSecret({
                name,
                kind,
                encryptedPayloadB64: envelope,
                encryptionAlg: 'AES-GCM-256',
                keySaltB64: saltB64 ?? undefined,
                url: url || undefined,
            });
            if (out.error) {
                setError(out.error);
                return;
            }
            // Patch strength flag separately so we don't leak it through create.
            if (strength && out.id) {
                const { updateSabvaultSecret } = await import('@/app/actions/sabvault.actions');
                await updateSabvaultSecret(out.id, { strength });
            }
            reset();
            setOpen(false);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create');
        } finally {
            setBusy(false);
        }
    }

    return (
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={!keyRecord}>New secret</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New secret</DialogTitle>
                    <DialogDescription>
                        Encrypted in your browser with your master key. Plaintext never reaches the server.
                    </DialogDescription>
                </DialogHeader>
                <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="sv-name">Name</Label>
                        <Input
                            id="sv-name"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Gmail – work"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label>Kind</Label>
                        <Select value={kind} onValueChange={(v) => setKind(v as SabvaultSecretKind)}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="Select kind" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="login">Login</ZoruSelectItem>
                                <ZoruSelectItem value="note">Note</ZoruSelectItem>
                                <ZoruSelectItem value="card">Card</ZoruSelectItem>
                                <ZoruSelectItem value="identity">Identity</ZoruSelectItem>
                                <ZoruSelectItem value="key">SSH / API key</ZoruSelectItem>
                                <ZoruSelectItem value="wifi">Wi-Fi</ZoruSelectItem>
                                <ZoruSelectItem value="server">Server</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    {kind === 'login' ? (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sv-url">URL</Label>
                                <Input id="sv-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sv-user">Username</Label>
                                <Input id="sv-user" value={username} onChange={(e) => setUsername(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sv-pw">Password</Label>
                                <Input
                                    id="sv-pw"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="sv-note">Note</Label>
                        <Textarea id="sv-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                    </div>
                    {error ? <div className="text-sm text-[var(--zoru-danger)]">{error}</div> : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy || !isUnlocked}>
                            {busy ? 'Encrypting…' : isUnlocked ? 'Save' : 'Unlock vault first'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </ZoruDialog>
    );
}
