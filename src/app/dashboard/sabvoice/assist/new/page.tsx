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
  RadioGroup,
  Radio,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
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
        deviceFingerprint:
          mode === 'unattended' ? device?.deviceFingerprint : undefined,
      });
      if (!token.success) throw new Error('Session created, but issuing token failed.');
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
    <div className="flex w-full flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>New SabAssist session</PageTitle>
          <PageDescription>
            Pick mode, optionally link to an existing call, and issue a one-time access token.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div>
        <Link
          href="/dashboard/sabvoice/assist"
          className="inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All sessions
        </Link>
      </div>

      {issued ? (
        <Card padding="lg" className="max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <ScreenShare className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
            <div className="font-medium text-[var(--st-text)]">Session ready</div>
            <Badge tone="success">Token issued</Badge>
          </div>

          <Alert tone="info">
            <AlertTitle>Share with the customer</AlertTitle>
            <AlertDescription>
              The customer must open this link in their browser and click "Allow technician to view your screen".
              {issued.oneTimePin && ' They will also need the PIN below.'}
            </AlertDescription>
          </Alert>

          <div className="grid gap-3">
            <Field label="Share URL">
              <div className="mt-1 flex gap-2">
                <Input readOnly value={shareUrl} />
                <Button
                  variant="outline"
                  iconLeft={Copy}
                  aria-label="Copy share URL"
                  onClick={() => copy(shareUrl, 'Share URL')}
                />
              </div>
            </Field>
            {issued.oneTimePin && (
              <Field label="One-time PIN">
                <div className="mt-1 flex items-center gap-2">
                  <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-4 py-2 font-mono text-2xl tracking-widest text-[var(--st-text)]">
                    {issued.oneTimePin}
                  </div>
                  <Button
                    variant="outline"
                    iconLeft={Copy}
                    aria-label="Copy one-time PIN"
                    onClick={() => copy(issued.oneTimePin ?? '', 'PIN')}
                  />
                </div>
              </Field>
            )}
            <div className="text-xs text-[var(--st-text-secondary)]">
              Expires {new Date(issued.expiresAt).toLocaleString()}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
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
        <Card padding="lg" className="max-w-2xl space-y-4">
          <Field label="Mode">
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              orientation="horizontal"
              aria-label="Session mode"
              className="mt-1 grid grid-cols-2 gap-2"
            >
              <label
                className={`flex cursor-pointer flex-col gap-1 rounded-[var(--st-radius)] border p-3 transition-colors ${
                  mode === 'attended'
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)]'
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                  <Radio value="attended" aria-label="Attended" />
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Attended
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Customer must enter a 6-digit PIN and click allow.
                </span>
              </label>
              <label
                className={`flex cursor-pointer flex-col gap-1 rounded-[var(--st-radius)] border p-3 transition-colors ${
                  mode === 'unattended'
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)]'
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                  <Radio value="unattended" aria-label="Unattended" />
                  <ServerCog className="h-4 w-4" aria-hidden="true" /> Unattended
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  Pre-registered device with cached consent.
                </span>
              </label>
            </RadioGroup>
          </Field>

          <Field label="Customer name">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Acme Corp - Alice"
            />
          </Field>

          <Field
            label="Customer email"
            required={mode === 'attended'}
          >
            <Input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="alice@acme.com"
            />
          </Field>

          <Field label="Link to existing call (optional)">
            <Select value={callId} onValueChange={setCallId}>
              <SelectTrigger aria-label="Linked call">
                <SelectValue placeholder="No linked call" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked call</SelectItem>
                {calls.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.fromNumber} - {c.toNumber} . {new Date(c.startedAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {mode === 'unattended' && (
            <Field
              label="Target device"
              required
              help={
                devices.length === 0 ? (
                  <span>
                    No devices yet -{' '}
                    <Link
                      href="/dashboard/sabvoice/assist/devices"
                      className="text-[var(--st-accent)]"
                    >
                      register one
                    </Link>
                    .
                  </span>
                ) : undefined
              }
            >
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger aria-label="Target device">
                  <SelectValue placeholder="Pick a registered device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.length === 0 ? (
                    <SelectItem value="__no_devices" disabled>
                      No registered devices.
                    </SelectItem>
                  ) : (
                    devices.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.label} {d.online ? '(online)' : '(offline)'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Notes">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the technician console."
            />
          </Field>

          {error && (
            <Alert tone="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              {submitting ? 'Creating...' : 'Create session & issue token'}
            </Button>
            <Link href="/dashboard/sabvoice/assist">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
