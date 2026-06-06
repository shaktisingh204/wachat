'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Badge, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Alert, AlertDescription } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ServerCog, Plus, ScreenShare, ArrowLeft, Trash2 } from 'lucide-react';
import {
  listSabassistDevices,
  registerSabassistDevice,
  deleteSabassistDevice,
  createSabassistSession,
  issueSabassistAccessToken,
} from '@/app/actions/sabassist.actions';

type DeviceRow = {
  _id: string;
  label: string;
  online: boolean;
  agentVersion?: string | null;
  deviceFingerprint: string;
  lastSeenAt?: string | null;
  createdAt?: string;
};

export default function SabassistDevicesPage() {
  const router = useRouter();
  const [rows, setRows] = React.useState<DeviceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [fingerprint, setFingerprint] = React.useState('');
  const [agentVersion, setAgentVersion] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await listSabassistDevices({});
      if (r.success) setRows(r.data as DeviceRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleRegister = async () => {
    setError(null);
    if (!label.trim() || !fingerprint.trim()) {
      setError('Label and fingerprint are required.');
      return;
    }
    setSubmitting(true);
    try {
      await registerSabassistDevice({
        label: label.trim(),
        deviceFingerprint: fingerprint.trim(),
        agentVersion: agentVersion || undefined,
      });
      setOpen(false);
      setLabel('');
      setFingerprint('');
      setAgentVersion('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSession = async (d: DeviceRow) => {
    const created = await createSabassistSession({
      mode: 'unattended',
      deviceId: d._id,
      customerName: d.label,
    });
    if (!created.success) return;
    await issueSabassistAccessToken({
      sessionId: created.id,
      requirePin: false,
      deviceFingerprint: d.deviceFingerprint,
      ttlSecs: 3600,
    });
    router.push(`/dashboard/sabvoice/assist/${created.id}`);
  };

  const handleDelete = async (id: string) => {
    await deleteSabassistDevice(id);
    await load();
  };

  return (
    <EntityListShell
      title="Registered devices"
      subtitle="Unattended SabAssist endpoints — start a session without customer interaction."
      loading={loading}
    >
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/sabvoice/assist"
          className="text-sm text-[var(--st-text-secondary)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Sessions
        </Link>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Register device
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-[var(--st-text-secondary)]">
          No devices registered yet.
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((d) => (
            <Card key={d._id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--st-bg-muted)] flex items-center justify-center text-[var(--st-accent)]">
                <ServerCog className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{d.label}</span>
                  {d.online ? (
                    <Badge variant="default">Online</Badge>
                  ) : (
                    <Badge variant="secondary">Offline</Badge>
                  )}
                  {d.agentVersion && (
                    <Badge variant="outline">agent {d.agentVersion}</Badge>
                  )}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-1 font-mono truncate">
                  {d.deviceFingerprint}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  Last seen{' '}
                  {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'never'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartSession(d)}
                  disabled={!d.online}
                  title={d.online ? 'Start an unattended session' : 'Device is offline'}
                >
                  <ScreenShare className="h-4 w-4 mr-1" /> Start
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(d._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a device</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="dev-label">Label</Label>
              <Input
                id="dev-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Front-desk kiosk"
              />
            </div>
            <div>
              <Label htmlFor="dev-fp">Device fingerprint</Label>
              <Input
                id="dev-fp"
                value={fingerprint}
                onChange={(e) => setFingerprint(e.target.value)}
                placeholder="emitted by the SabAssist agent at install time"
              />
            </div>
            <div>
              <Label htmlFor="dev-ver">Agent version (optional)</Label>
              <Input
                id="dev-ver"
                value={agentVersion}
                onChange={(e) => setAgentVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={submitting}>
              {submitting ? 'Registering…' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
