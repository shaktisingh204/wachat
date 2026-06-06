'use client';
import { fmtDate } from "@/lib/utils";

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { LoaderCircle, Mail, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';

import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Separator, Badge } from '@/components/sabcrm/20ui/compat';
import {
  disable2fa,
  disableEmail2fa,
  enableEmail2fa,
  generateAuthenticator2faSecret,
  getMy2faStatus,
  regenerateBackupCodes,
  verifyAuthenticator2faSetup,
  verifyEmail2faCode,
  type TwoFactorMethod,
  type TwoFactorStatus,
  getRecentLoginAttempts,
  type LoginAttempt,
} from '@/app/actions/two-fa.actions';

type TabKey = 'email' | 'totp';

export default function TwoFactorSetupPage() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [tab, setTab] = useState<TabKey>('email');
  const [, startLoad] = useTransition();

  const refresh = useCallback(() => {
    startLoad(async () => {
      const [r, attempts] = await Promise.all([
        getMy2faStatus(),
        getRecentLoginAttempts()
      ]);
      if (r.ok && r.data) setStatus(r.data);
      if (attempts.ok && attempts.data) setLoginAttempts(attempts.data);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.method) setTab(status.method === 'totp' ? 'totp' : 'email');
  }, [status?.method]);

  const enabledMethod: TwoFactorMethod | null = status?.method ?? null;
  const isEnabled = Boolean(status?.enabled);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
          Add an extra step to your sign-in to keep your account safe.
        </p>
      </header>

      <Card>
        <CardBody className="flex items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            {isEnabled ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--st-text)]" />
            ) : (
              <ShieldOff className="mt-0.5 h-5 w-5 text-[var(--st-text)]" />
            )}
            <div>
              <p className="text-sm font-medium">
                {isEnabled ? '2FA is enabled' : '2FA is not enabled'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                {isEnabled
                  ? `Method: ${enabledMethod === 'totp' ? 'Authenticator app' : 'Email'}`
                  : 'Pick a method below and follow the steps.'}
              </p>
            </div>
          </div>
          {isEnabled ? (
            <DisableButton onDone={refresh} />
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
        </CardBody>
      </Card>

      <div className="inline-flex rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1">
        <button
          type="button"
          onClick={() => setTab('email')}
          className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm transition ${
            tab === 'email' ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow' : 'text-[var(--st-text-secondary)]'
          }`}
        >
          <Mail className="h-4 w-4" /> Email
        </button>
        <button
          type="button"
          onClick={() => setTab('totp')}
          className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm transition ${
            tab === 'totp' ? 'bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow' : 'text-[var(--st-text-secondary)]'
          }`}
        >
          <Smartphone className="h-4 w-4" /> Authenticator app
        </button>
      </div>

      {tab === 'email' ? (
        <EmailPanel status={status} onChanged={refresh} />
      ) : (
        <TotpPanel status={status} onChanged={refresh} />
      )}

      
      {isEnabled ? <BackupCodesPanel status={status} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Audit Log</CardTitle>
        </CardHeader>
        <CardBody>
          {loginAttempts.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No recent login attempts found.</p>
          ) : (
            <div className="space-y-4">
              {loginAttempts.map((attempt) => (
                <div key={attempt._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--st-border)] pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      {attempt.ip}
                      <Badge variant={attempt.status === 'success' ? 'default' : attempt.status === 'pending_2fa' ? 'outline' : 'destructive'}>
                        {attempt.status === 'success' ? 'Success' : attempt.status === 'pending_2fa' ? '2FA Pending' : 'Failed'}
                      </Badge>
                    </p>
                    <p className="text-xs text-[var(--st-text-secondary)] truncate max-w-sm mt-1" title={attempt.userAgent}>
                      {attempt.userAgent}
                    </p>
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)] sm:text-right whitespace-nowrap">
                    {fmtDate(attempt.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

    </div>
  );
}

/* ────────────────────── Email panel ────────────────────── */

function EmailPanel({
  status,
  onChanged,
}: {
  status: TwoFactorStatus | null;
  onChanged: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTx] = useTransition();
  const isMine = status?.method === 'email' && status.enabled;

  const onSend = () => {
    setErr(null);
    setMsg(null);
    startTx(async () => {
      const r = await enableEmail2fa();
      if (r.ok) {
        setSent(true);
        setMsg(`Code sent to ${status?.email ?? 'your inbox'}.`);
      } else setErr(r.error ?? 'Failed to send code.');
    });
  };

  const onVerify = () => {
    setErr(null);
    setMsg(null);
    startTx(async () => {
      const r = await verifyEmail2faCode(code);
      if (r.ok) {
        setMsg('Email 2FA enabled.');
        setCode('');
        setSent(false);
        onChanged();
      } else setErr(r.error ?? 'Verification failed.');
    });
  };

  const onDisable = () => {
    setErr(null);
    setMsg(null);
    startTx(async () => {
      const r = await disableEmail2fa();
      if (r.ok) {
        setMsg('Email 2FA disabled.');
        onChanged();
      } else setErr(r.error ?? 'Failed to disable.');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email-based 2FA</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--st-text-secondary)]">
          A 6-digit code is sent to <strong>{status?.email ?? 'your email'}</strong> every
          time you sign in.
        </p>

        {isMine ? (
          <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3">
            <p className="text-sm">Email 2FA is currently active.</p>
            <Button variant="outline" onClick={onDisable} disabled={pending}>
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Disable
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Button onClick={onSend} disabled={pending}>
                {pending && !sent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {sent ? 'Resend code' : 'Send verification code'}
              </Button>
            </div>
            {sent ? (
              <div className="space-y-2">
                <Label htmlFor="email-code">Enter the 6-digit code</Label>
                <div className="flex gap-2">
                  <Input
                    id="email-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                  />
                  <Button onClick={onVerify} disabled={pending || code.length !== 6}>
                    {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Verify & enable
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {msg ? <p className="text-xs text-[var(--st-text)]">{msg}</p> : null}
        {err ? <p className="text-xs text-[var(--st-text)]">{err}</p> : null}
      </CardBody>
    </Card>
  );
}

/* ────────────────────── TOTP panel ────────────────────── */

function TotpPanel({
  status,
  onChanged,
}: {
  status: TwoFactorStatus | null;
  onChanged: () => void;
}) {
  const [setup, setSetup] = useState<
    { secret: string; qrUrl: string; backupCodes: string[] } | null
  >(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTx] = useTransition();
  const isMine = status?.method === 'totp' && status.enabled;

  const onStart = () => {
    setErr(null);
    setMsg(null);
    startTx(async () => {
      const r = await generateAuthenticator2faSecret();
      if (r.ok && r.data) setSetup(r.data);
      else setErr(r.error ?? 'Failed to start setup.');
    });
  };

  const onVerify = () => {
    setErr(null);
    setMsg(null);
    startTx(async () => {
      const r = await verifyAuthenticator2faSetup(code);
      if (r.ok) {
        setMsg('Authenticator 2FA enabled. Store your backup codes safely.');
        setCode('');
        onChanged();
      } else setErr(r.error ?? 'Verification failed.');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Authenticator app</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--st-text-secondary)]">
          Use any TOTP app (Google Authenticator, 1Password, Authy) to generate a
          rotating 6-digit code.
        </p>

        {isMine ? (
          <p className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3 text-sm">
            Authenticator 2FA is currently active. Use the disable button at the top
            to remove it (requires password).
          </p>
        ) : !setup ? (
          <Button onClick={onStart} disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Set up authenticator
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrUrl}
                alt="Scan this QR with your authenticator app"
                width={200}
                height={200}
                className="rounded border border-[var(--st-border)] bg-white p-2"
              />
              <div className="space-y-2">
                <p className="text-sm">
                  Scan the QR or enter this code manually in your authenticator app:
                </p>
                <code className="block rounded bg-[var(--st-bg)] px-3 py-2 text-sm font-mono">
                  {setup.secret}
                </code>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totp-code">Enter the 6-digit code from the app</Label>
              <div className="flex gap-2">
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                />
                <Button onClick={onVerify} disabled={pending || code.length !== 6}>
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Verify & enable
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium">Backup codes</p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Save these somewhere safe — each one works once if you lose access to
                your authenticator app.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
                {setup.backupCodes.map((c) => (
                  <code key={c} className="rounded bg-[var(--st-bg)] px-2 py-1">
                    {c}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}

        {msg ? <p className="text-xs text-[var(--st-text)]">{msg}</p> : null}
        {err ? <p className="text-xs text-[var(--st-text)]">{err}</p> : null}
      </CardBody>
    </Card>
  );
}

/* ────────────────────── Backup codes ────────────────────── */

function BackupCodesPanel({ status }: { status: TwoFactorStatus | null }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, startTx] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const remaining = status?.backupCodesRemaining ?? 0;

  const onRegen = () => {
    setErr(null);
    startTx(async () => {
      const r = await regenerateBackupCodes();
      if (r.ok && r.data) setCodes(r.data.codes);
      else setErr(r.error ?? 'Failed.');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backup codes</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-[var(--st-text-secondary)]">
          You have <strong>{remaining}</strong> unused backup code{remaining === 1 ? '' : 's'}.
          Regenerating will invalidate any existing codes.
        </p>
        <Button variant="outline" onClick={onRegen} disabled={pending}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Regenerate codes
        </Button>
        {codes ? (
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {codes.map((c) => (
              <code key={c} className="rounded bg-[var(--st-bg)] px-2 py-1">
                {c}
              </code>
            ))}
          </div>
        ) : null}
        {err ? <p className="text-xs text-[var(--st-text)]">{err}</p> : null}
      </CardBody>
    </Card>
  );
}

/* ────────────────────── Disable button ────────────────────── */

function DisableButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  const onSubmit = () => {
    setErr(null);
    startTx(async () => {
      const r = await disable2fa(pwd);
      if (r.ok) {
        setOpen(false);
        setPwd('');
        onDone();
      } else setErr(r.error ?? 'Failed to disable.');
    });
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Disable 2FA
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        placeholder="Confirm password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        className="w-56"
      />
      <Button onClick={onSubmit} disabled={pending || !pwd}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        Confirm
      </Button>
      <Button variant="ghost" onClick={() => { setOpen(false); setErr(null); }}>
        Cancel
      </Button>
      {err ? <span className="text-xs text-[var(--st-text)]">{err}</span> : null}
    </div>
  );
}
