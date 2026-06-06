'use client';
import { fmtDate } from "@/lib/utils";

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Mail, ShieldCheck, ShieldOff, Smartphone, History } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Field,
  Separator,
  Badge,
  SegmentedControl,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
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

const TAB_ITEMS = [
  { value: 'email' as const, label: 'Email', icon: Mail },
  { value: 'totp' as const, label: 'Authenticator app', icon: Smartphone },
];

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
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageTitle>Two-factor authentication</PageTitle>
          <PageDescription>
            Add an extra step to your sign-in to keep your account safe.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card>
        <CardBody className="flex items-start justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            {isEnabled ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--st-status-ok)]" aria-hidden="true" />
            ) : (
              <ShieldOff className="mt-0.5 h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--st-text)]">
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
            <Badge tone="neutral" kind="outline">Disabled</Badge>
          )}
        </CardBody>
      </Card>

      <SegmentedControl
        items={TAB_ITEMS}
        value={tab}
        onChange={(v) => setTab(v)}
        aria-label="Two-factor method"
      />

      {tab === 'email' ? (
        <EmailPanel status={status} onChanged={refresh} />
      ) : (
        <TotpPanel status={status} onChanged={refresh} />
      )}

      {isEnabled ? <BackupCodesPanel status={status} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security audit log</CardTitle>
        </CardHeader>
        <CardBody>
          {loginAttempts.length === 0 ? (
            <EmptyState
              icon={History}
              title="No recent login attempts"
              description="Sign-in activity will appear here as it happens."
              size="sm"
            />
          ) : (
            <Table density="compact" hover>
              <THead>
                <Tr>
                  <Th>IP address</Th>
                  <Th>Device</Th>
                  <Th align="right">When</Th>
                </Tr>
              </THead>
              <TBody>
                {loginAttempts.map((attempt) => (
                  <Tr key={attempt._id}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--st-text)]">{attempt.ip}</span>
                        <Badge
                          tone={
                            attempt.status === 'success'
                              ? 'success'
                              : attempt.status === 'pending_2fa'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {attempt.status === 'success'
                            ? 'Success'
                            : attempt.status === 'pending_2fa'
                              ? '2FA pending'
                              : 'Failed'}
                        </Badge>
                      </span>
                    </Td>
                    <Td truncate>
                      <span
                        className="block max-w-xs truncate text-xs text-[var(--st-text-secondary)]"
                        title={attempt.userAgent}
                      >
                        {attempt.userAgent}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="whitespace-nowrap text-xs text-[var(--st-text-secondary)]">
                        {fmtDate(attempt.createdAt)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* Email panel */

function EmailPanel({
  status,
  onChanged,
}: {
  status: TwoFactorStatus | null;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [pending, startTx] = useTransition();
  const isMine = status?.method === 'email' && status.enabled;

  const onSend = () => {
    startTx(async () => {
      const r = await enableEmail2fa();
      if (r.ok) {
        setSent(true);
        toast.success(`Code sent to ${status?.email ?? 'your inbox'}.`);
      } else toast.error(r.error ?? 'Failed to send code.');
    });
  };

  const onVerify = () => {
    startTx(async () => {
      const r = await verifyEmail2faCode(code);
      if (r.ok) {
        toast.success('Email 2FA enabled.');
        setCode('');
        setSent(false);
        onChanged();
      } else toast.error(r.error ?? 'Verification failed.');
    });
  };

  const onDisable = () => {
    startTx(async () => {
      const r = await disableEmail2fa();
      if (r.ok) {
        toast.success('Email 2FA disabled.');
        onChanged();
      } else toast.error(r.error ?? 'Failed to disable.');
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
          <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
            <p className="text-sm text-[var(--st-text)]">Email 2FA is currently active.</p>
            <Button variant="outline" onClick={onDisable} loading={pending}>
              Disable
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Button variant="primary" onClick={onSend} loading={pending && !sent}>
                {sent ? 'Resend code' : 'Send verification code'}
              </Button>
            </div>
            {sent ? (
              <Field label="Enter the 6-digit code">
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                  />
                  <Button variant="primary" onClick={onVerify} loading={pending} disabled={code.length !== 6}>
                    Verify and enable
                  </Button>
                </div>
              </Field>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* TOTP panel */

function TotpPanel({
  status,
  onChanged,
}: {
  status: TwoFactorStatus | null;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [setup, setSetup] = useState<
    { secret: string; qrUrl: string; backupCodes: string[] } | null
  >(null);
  const [code, setCode] = useState('');
  const [pending, startTx] = useTransition();
  const isMine = status?.method === 'totp' && status.enabled;

  const onStart = () => {
    startTx(async () => {
      const r = await generateAuthenticator2faSecret();
      if (r.ok && r.data) setSetup(r.data);
      else toast.error(r.error ?? 'Failed to start setup.');
    });
  };

  const onVerify = () => {
    startTx(async () => {
      const r = await verifyAuthenticator2faSetup(code);
      if (r.ok) {
        toast.success('Authenticator 2FA enabled. Store your backup codes safely.');
        setCode('');
        onChanged();
      } else toast.error(r.error ?? 'Verification failed.');
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
          <p className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-text)]">
            Authenticator 2FA is currently active. Use the disable button at the top
            to remove it (requires password).
          </p>
        ) : !setup ? (
          <Button variant="primary" onClick={onStart} loading={pending}>
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
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-white p-2"
              />
              <div className="space-y-2">
                <p className="text-sm text-[var(--st-text)]">
                  Scan the QR or enter this code manually in your authenticator app:
                </p>
                <code className="block rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--st-text)]">
                  {setup.secret}
                </code>
              </div>
            </div>

            <Field label="Enter the 6-digit code from the app">
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                />
                <Button variant="primary" onClick={onVerify} loading={pending} disabled={code.length !== 6}>
                  Verify and enable
                </Button>
              </div>
            </Field>

            <Separator />

            <div>
              <p className="text-sm font-medium text-[var(--st-text)]">Backup codes</p>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Save these somewhere safe. Each one works once if you lose access to
                your authenticator app.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm">
                {setup.backupCodes.map((c) => (
                  <code key={c} className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1 text-[var(--st-text)]">
                    {c}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* Backup codes */

function BackupCodesPanel({ status }: { status: TwoFactorStatus | null }) {
  const { toast } = useToast();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, startTx] = useTransition();
  const remaining = status?.backupCodesRemaining ?? 0;

  const onRegen = () => {
    startTx(async () => {
      const r = await regenerateBackupCodes();
      if (r.ok && r.data) {
        setCodes(r.data.codes);
        toast.success('New backup codes generated.');
      } else toast.error(r.error ?? 'Failed.');
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
        <Button variant="outline" onClick={onRegen} loading={pending}>
          Regenerate codes
        </Button>
        {codes ? (
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {codes.map((c) => (
              <code key={c} className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1 text-[var(--st-text)]">
                {c}
              </code>
            ))}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* Disable button */

function DisableButton({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pending, startTx] = useTransition();

  const onSubmit = () => {
    startTx(async () => {
      const r = await disable2fa(pwd);
      if (r.ok) {
        setOpen(false);
        setPwd('');
        toast.success('Two-factor authentication disabled.');
        onDone();
      } else toast.error(r.error ?? 'Failed to disable.');
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
      <Field label="Confirm password" className="w-56">
        <Input
          type="password"
          placeholder="Confirm password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
      </Field>
      <Button variant="primary" onClick={onSubmit} loading={pending} disabled={!pwd}>
        Confirm
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
