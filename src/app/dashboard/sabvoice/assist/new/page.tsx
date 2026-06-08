'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  Input,
  Textarea,
  Field,
  RadioCardGroup,
  RadioCard,
  SelectField,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  IconButton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { ScreenShare, KeyRound, ServerCog, ArrowLeft, Copy } from 'lucide-react';
import {
  createSabassistSession,
  issueSabassistAccessToken,
  listSabassistDevices,
} from '@/app/actions/sabassist.actions';
import { listVoiceCallCdrs } from '@/app/actions/sabvoice.actions';

type Mode = 'attended' | 'unattended';

type CallOption = { _id: string; fromNumber: string; toNumber: string; startedAt: string };
type DeviceOption = { _id: string; label: string; online: boolean; deviceFingerprint: string };

type IssuedToken = {
  id: string;
  token: string;
  oneTimePin?: string;
  expiresAt: string;
  sessionId: string;
};

export default function SabassistNewSessionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<Mode>('attended');
  const [customerName, setCustomerName] = React.useState('');
  const [customerEmail, setCustomerEmail] = React.useState('');
  const [callId, setCallId] = React.useState<string>('none');
  const [deviceId, setDeviceId] = React.useState<string>('');
  const [notes, setNotes] = React.useState('');

  const [calls, setCalls] = React.useState<CallOption[]>([]);
  const [devices, setDevices] = React.useState<DeviceOption[]>([]);
  const [issued, setIssued] = React.useState<IssuedToken | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const r = await listVoiceCallCdrs({});
      if (r.success) setCalls((r.data as CallOption[]).slice(0, 100));
    })();
  }, []);

  React.useEffect(() => {
    if (mode !== 'unattended') return;
    void (async () => {
      const r = await listSabassistDevices({});
      if (r.success) setDevices(r.data as DeviceOption[]);
    })();
  }, [mode]);

  const handleSubmit = async () => {
    setError(null);
    if (mode === 'attended' && !customerEmail.trim()) {
      setError('Customer email is required for attended sessions.');
      return;
    }
    if (mode === 'unattended' && !deviceId) {
      setError('Pick a registered device for unattended sessions.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSabassistSession({
        mode,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        callId: callId === 'none' ? undefined : callId,
        deviceId: mode === 'unattended' ? deviceId : undefined,
        notes: notes || undefined,
      });
      if (!created.success) throw new Error('Failed to create session.');

      const device = devices.find((d) => d._id === deviceId);
      const token = await issueSabassistAccessToken({
        sessionId: created.id,
        ttlSecs: 1800,
        requirePin: mode === 'attended',
        deviceFingerprint: mode === 'unattended' ? device?.deviceFingerprint : undefined,
      });
      if (!token.success) throw new Error('Session created, but issuing the token failed.');
      setIssued({
        id: token.id,
        token: token.token,
        oneTimePin: token.oneTimePin,
        expiresAt: token.expiresAt,
        sessionId: created.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = issued
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/assist/${issued.token}`
    : '';

  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${what} copied to clipboard`);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Remote assist</PageEyebrow>
          <PageTitle>New session</PageTitle>
          <PageDescription>
            Pick a mode, optionally link an existing call, and issue a one-time access token.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="ghost">
            <Link href="/dashboard/sabvoice/assist">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All sessions
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {issued ? (
        <Card variant="outlined" padding="lg" className="flex flex-col gap-[var(--st-space-4)]">
          <div className="flex items-center gap-2">
            <ScreenShare className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
            <span className="font-medium text-[var(--st-text)]">Session ready</span>
            <Badge tone="success">Token issued</Badge>
          </div>

          <Alert tone="info">
            <AlertTitle>Share with the customer</AlertTitle>
            <AlertDescription>
              The customer opens this link and clicks &ldquo;Allow technician to view your
              screen&rdquo;.
              {issued.oneTimePin ? ' They will also need the PIN below.' : ''}
            </AlertDescription>
          </Alert>

          <Field label="Share URL">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} />
              <IconButton
                variant="outline"
                icon={Copy}
                label="Copy share URL"
                onClick={() => copy(shareUrl, 'Share URL')}
              />
            </div>
          </Field>

          {issued.oneTimePin ? (
            <Field label="One-time PIN">
              <div className="flex items-center gap-2">
                <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-4 py-2 font-mono text-2xl tabular-nums tracking-widest text-[var(--st-text)]">
                  {issued.oneTimePin}
                </div>
                <IconButton
                  variant="outline"
                  icon={Copy}
                  label="Copy one-time PIN"
                  onClick={() => copy(issued.oneTimePin ?? '', 'PIN')}
                />
              </div>
            </Field>
          ) : null}

          <div className="text-xs tabular-nums text-[var(--st-text-secondary)]">
            Expires {new Date(issued.expiresAt).toLocaleString()}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              onClick={() => router.push(`/dashboard/sabvoice/assist/${issued.sessionId}`)}
            >
              Open technician console
            </Button>
            <Button variant="outline" onClick={() => setIssued(null)}>
              Issue another session
            </Button>
          </div>
        </Card>
      ) : (
        <Card variant="outlined" padding="lg" className="flex flex-col gap-[var(--st-space-4)]">
          <Field label="Mode">
            <RadioCardGroup
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              label="Session mode"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <RadioCard
                value="attended"
                label="Attended"
                description="Customer enters a 6-digit PIN and clicks allow."
                icon={KeyRound}
              />
              <RadioCard
                value="unattended"
                label="Unattended"
                description="Pre-registered device with cached consent."
                icon={ServerCog}
              />
            </RadioCardGroup>
          </Field>

          <Field label="Customer name">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Acme Corp — Alice"
            />
          </Field>

          <Field label="Customer email" required={mode === 'attended'}>
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="alice@acme.com"
            />
          </Field>

          <Field label="Link to an existing call">
            <SelectField
              value={callId}
              onChange={(v) => setCallId(v ?? 'none')}
              placeholder="No linked call"
              options={[
                { value: 'none', label: 'No linked call' },
                ...calls.map((c) => ({
                  value: c._id,
                  label: `${c.fromNumber} → ${c.toNumber} · ${new Date(c.startedAt).toLocaleString()}`,
                })),
              ]}
            />
          </Field>

          {mode === 'unattended' ? (
            <Field
              label="Target device"
              required
              help={
                devices.length === 0 ? (
                  <span>
                    No devices yet —{' '}
                    <Link href="/dashboard/sabvoice/assist/devices" className="text-[var(--st-accent)]">
                      register one
                    </Link>
                    .
                  </span>
                ) : undefined
              }
            >
              <SelectField
                value={deviceId}
                onChange={(v) => setDeviceId(v ?? '')}
                placeholder="Pick a registered device"
                options={devices.map((d) => ({
                  value: d._id,
                  label: `${d.label} ${d.online ? '(online)' : '(offline)'}`,
                }))}
              />
            </Field>
          ) : null}

          <Field label="Notes">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the technician console."
            />
          </Field>

          {error ? (
            <Alert tone="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              Create session and issue token
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/sabvoice/assist">Cancel</Link>
            </Button>
          </div>
        </Card>
      )}
    </main>
  );
}
