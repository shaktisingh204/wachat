'use client';

/**
 * Sab Vault — the locked gate.
 *
 * Two intentional, calm states (never an error screen): SETUP (first run, mint a
 * master password) and UNLOCK (returning, prove the master password). Both are a
 * single centred card — the locked state should feel deliberate, not broken.
 *
 * No crypto lives here. The parent (`vault-client.tsx`) owns the master key and
 * all WebCrypto calls; this component only collects input and reports it up via
 * `onCreate` / `onUnlock`. The master password is held in local component state
 * only while typing and is never persisted anywhere.
 */

import * as React from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Button, Card, CardBody, Field, Input } from '@/components/sabcrm/20ui';
import { scorePasswordStrength } from '@/lib/sabfiles/vault/crypto';

const STRENGTH_LABEL: Record<ReturnType<typeof scorePasswordStrength>['label'], string> = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong',
    very_strong: 'Very strong',
};

/** Map the 0..4 score onto one of the 20ui progress tones (single accent family). */
function strengthTone(score: number): 'danger' | 'warning' | 'success' {
    if (score <= 1) return 'danger';
    if (score === 2) return 'warning';
    return 'success';
}

type GateProps = {
    mode: 'setup' | 'unlock';
    busy: boolean;
    error: string | null;
    /** SETUP: derive a key from `password`, store salt + canary, then unlock. */
    onCreate: (password: string) => void;
    /** UNLOCK: derive a key from `password` and verify against the canary. */
    onUnlock: (password: string) => void;
};

export function VaultGate({ mode, busy, error, onCreate, onUnlock }: GateProps): React.JSX.Element {
    if (mode === 'setup') {
        return <VaultSetup busy={busy} error={error} onCreate={onCreate} />;
    }
    return <VaultUnlock busy={busy} error={error} onUnlock={onUnlock} />;
}

/* ─── Shared shell ──────────────────────────────────────────────────────── */

function GateShell({
    icon,
    title,
    intro,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    intro: React.ReactNode;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div className="sv-gate">
            <Card variant="elevated" padding="lg" className="sv-gate__card">
                <CardBody className="sv-gate__body">
                    <span className="sv-gate__seal" aria-hidden="true">
                        {icon}
                    </span>
                    <div className="sv-gate__lede">
                        <p className="sv-gate__eyebrow">SabFiles</p>
                        <h1 className="sv-gate__title">{title}</h1>
                        <p className="sv-gate__intro">{intro}</p>
                    </div>
                    {children}
                </CardBody>
            </Card>
        </div>
    );
}

/* ─── Setup ─────────────────────────────────────────────────────────────── */

function VaultSetup({
    busy,
    error,
    onCreate,
}: {
    busy: boolean;
    error: string | null;
    onCreate: (password: string) => void;
}): React.JSX.Element {
    const [password, setPassword] = React.useState('');
    const [confirm, setConfirm] = React.useState('');
    const [show, setShow] = React.useState(false);
    const [ack, setAck] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const ackId = React.useId();

    const strength = scorePasswordStrength(password);
    const mismatch = touched && confirm.length > 0 && confirm !== password;
    const tooWeak = password.length > 0 && strength.score < 2;
    const canSubmit = password.length >= 8 && confirm === password && ack && strength.score >= 2 && !busy;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        onCreate(password);
    };

    return (
        <GateShell
            icon={<ShieldCheck size={26} aria-hidden="true" />}
            title="Set up your vault"
            intro={
                <>
                    Sab Vault is a zero-knowledge encrypted space. Your master password is the only
                    key, and it never leaves this device. We cannot recover it: if you forget it, the
                    files inside are unrecoverable.
                </>
            }
        >
            <form className="sv-gate__form" onSubmit={handleSubmit} noValidate>
                <Field
                    label="Master password"
                    help="At least 8 characters. A long passphrase is stronger than a short complex one."
                    error={tooWeak && touched ? 'Choose a stronger password before continuing.' : undefined}
                >
                    <Input
                        type={show ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your master password"
                        iconLeft={KeyRound}
                        trailingSlot={
                            <button
                                type="button"
                                className="sv-reveal"
                                onClick={() => setShow((s) => !s)}
                                aria-pressed={show}
                                aria-label={show ? 'Hide password' : 'Show password'}
                            >
                                {show ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                            </button>
                        }
                    />
                </Field>

                {password.length > 0 ? (
                    <div className="sv-strength" data-tone={strengthTone(strength.score)}>
                        <div className="sv-strength__track" aria-hidden="true">
                            <span className="sv-strength__fill" style={{ width: `${(strength.score / 4) * 100}%` }} />
                        </div>
                        <p className="sv-strength__label">
                            Password strength: <strong>{STRENGTH_LABEL[strength.label]}</strong>
                        </p>
                    </div>
                ) : null}

                <Field
                    label="Confirm master password"
                    error={mismatch ? 'Passwords do not match.' : undefined}
                >
                    <Input
                        type={show ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onBlur={() => setTouched(true)}
                        placeholder="Re-enter your master password"
                        iconLeft={Lock}
                    />
                </Field>

                <label className="sv-ack" htmlFor={ackId}>
                    <input
                        id={ackId}
                        type="checkbox"
                        className="sv-ack__box"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                    />
                    <span className="sv-ack__text">
                        I understand that this password cannot be recovered, and that losing it means
                        losing access to everything in my vault.
                    </span>
                </label>

                {error ? (
                    <p className="sv-gate__alert" role="alert">
                        <ShieldAlert size={15} aria-hidden="true" />
                        {error}
                    </p>
                ) : null}

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    iconLeft={busy ? Loader2 : ShieldCheck}
                    loading={busy}
                    disabled={!canSubmit}
                    className="sv-gate__submit"
                >
                    {busy ? 'Creating vault' : 'Create encrypted vault'}
                </Button>
            </form>
        </GateShell>
    );
}

/* ─── Unlock ────────────────────────────────────────────────────────────── */

function VaultUnlock({
    busy,
    error,
    onUnlock,
}: {
    busy: boolean;
    error: string | null;
    onUnlock: (password: string) => void;
}): React.JSX.Element {
    const [password, setPassword] = React.useState('');
    const [show, setShow] = React.useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || busy) return;
        onUnlock(password);
    };

    return (
        <GateShell
            icon={<Lock size={26} aria-hidden="true" />}
            title="Vault locked"
            intro="Enter your master password to decrypt this space. Your password is verified on this device and never sent to our servers."
        >
            <form className="sv-gate__form" onSubmit={handleSubmit} noValidate>
                <Field label="Master password" error={error ?? undefined}>
                    <Input
                        type={show ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your master password"
                        iconLeft={KeyRound}
                        autoFocus
                        trailingSlot={
                            <button
                                type="button"
                                className="sv-reveal"
                                onClick={() => setShow((s) => !s)}
                                aria-pressed={show}
                                aria-label={show ? 'Hide password' : 'Show password'}
                            >
                                {show ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                            </button>
                        }
                    />
                </Field>

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    iconLeft={busy ? Loader2 : KeyRound}
                    loading={busy}
                    disabled={!password || busy}
                    className="sv-gate__submit"
                >
                    {busy ? 'Unlocking' : 'Unlock vault'}
                </Button>
            </form>
        </GateShell>
    );
}
