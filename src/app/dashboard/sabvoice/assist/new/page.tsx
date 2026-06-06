'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input, Label, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Alert, AlertTitle, AlertDescription } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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

  return (
    <EntityListShell
      title="New SabAssist session"
      subtitle="Pick mode, optionally link to an existing call, and issue a one-time access token."
    >
      <div className="mb-4">
        <Link
          href="/dashboard/sabvoice/assist"
          className="text-sm text-[var(--st-text-secondary)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> All sessions
        </Link>
      </div>

      {issued ? (
        <Card className="p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <ScreenShare className="h-5 w-5 text-[var(--st-accent)]" />
            <div className="font-medium">Session ready</div>
            <Badge variant="default">Token issued</Badge>
          </div>

          <Alert>
            <AlertTitle>Share with the customer</AlertTitle>
            <AlertDescription>
              The customer must open this link in their browser and click
              &ldquo;Allow technician to view your screen&rdquo;.
              {issued.oneTimePin && ' They will also need the PIN below.'}
            </AlertDescription>
          </Alert>

          <div className="grid gap-3">
            <div>
              <Label>Share URL</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={shareUrl} />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(shareUrl);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {issued.oneTimePin && (
              <div>
                <Label>One-time PIN</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="font-mono text-2xl tracking-widest bg-[var(--st-bg-muted)] px-4 py-2 rounded">
                    {issued.oneTimePin}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(issued.oneTimePin ?? '');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="text-xs text-[var(--st-text-secondary)]">
              Expires {new Date(issued.expiresAt).toLocaleString()}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => router.push(`/dashboard/sabvoice/assist/${issued.sessionId}`)}>
              Open technician console
            </Button>
            <Button variant="outline" onClick={() => setIssued(null)}>
              Issue another session
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 max-w-2xl space-y-4">
          <div>
            <Label>Mode</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                className={`p-3 rounded-lg border text-left transition-colors ${
                  mode === 'attended'
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-muted)]'
                    : 'border-[var(--st-border)]'
                }`}
                onClick={() => setMode('attended')}
              >
                <div className="flex items-center gap-2 font-medium">
                  <KeyRound className="h-4 w-4" /> Attended
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">
                  Customer must enter a 6-digit PIN and click allow.
                </div>
              </button>
              <button
                type="button"
                className={`p-3 rounded-lg border text-left transition-colors ${
                  mode === 'unattended'
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-muted)]'
                    : 'border-[var(--st-border)]'
                }`}
                onClick={() => setMode('unattended')}
              >
                <div className="flex items-center gap-2 font-medium">
                  <ServerCog className="h-4 w-4" /> Unattended
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">
                  Pre-registered device with cached consent.
                </div>
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="customerName">Customer name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Acme Corp — Alice"
            />
          </div>

          <div>
            <Label htmlFor="customerEmail">
              Customer email{mode === 'attended' && ' *'}
            </Label>
            <Input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="alice@acme.com"
            />
          </div>

          <div>
            <Label>Link to existing call (optional)</Label>
            <Select value={callId} onValueChange={setCallId}>
              <SelectTrigger>
                <SelectValue placeholder="No linked call" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked call</SelectItem>
                {calls.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.fromNumber} → {c.toNumber} ·{' '}
                    {new Date(c.startedAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'unattended' && (
            <div>
              <Label>Target device *</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a registered device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.length === 0 ? (
                    <SelectItem value="__no_devices" disabled>
                      No registered devices.{' '}
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
              {devices.length === 0 && (
                <div className="text-xs text-[var(--st-text-secondary)] mt-1">
                  No devices yet —{' '}
                  <Link href="/dashboard/sabvoice/assist/devices" className="text-[var(--st-accent)]">
                    register one
                  </Link>
                  .
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the technician console."
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create session & issue token'}
            </Button>
            <Link href="/dashboard/sabvoice/assist">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </Card>
      )}
    </EntityListShell>
  );
}
