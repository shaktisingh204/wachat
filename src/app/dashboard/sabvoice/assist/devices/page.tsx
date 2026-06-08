'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  Input,
  Field,
  Modal,
  Alert,
  AlertDescription,
  EmptyState,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();
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
      toast.success('Device registered');
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
    try {
      await deleteSabassistDevice(id);
      toast.success('Device removed');
      await load();
    } catch (e) {
      toast.error(`Remove failed: ${(e as Error).message}`);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Remote assist</PageEyebrow>
          <PageTitle>Registered devices</PageTitle>
          <PageDescription>
            Unattended SabAssist endpoints — start a session without customer interaction.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="ghost">
            <Link href="/dashboard/sabvoice/assist">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Sessions
            </Link>
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
            Register device
          </Button>
        </PageActions>
      </PageHeader>

      {loading ? (
        <div className="flex flex-col gap-[var(--st-space-3)]" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={ServerCog}
            title="No devices registered"
            description="Register an endpoint to launch unattended screen-share sessions."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
                Register device
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          {rows.map((d) => (
            <Card key={d._id} variant="outlined" className="flex items-center gap-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                style={{ background: '#0d94881a', color: '#0d9488' }}
              >
                <ServerCog className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-[var(--st-text)]">{d.label}</span>
                  <Badge tone={d.online ? 'success' : 'neutral'}>
                    {d.online ? 'Online' : 'Offline'}
                  </Badge>
                  {d.agentVersion ? (
                    <Badge tone="neutral" kind="outline">
                      agent {d.agentVersion}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-[var(--st-text-secondary)]">
                  {d.deviceFingerprint}
                </div>
                <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">
                  Last seen {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'never'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={ScreenShare}
                  onClick={() => handleStartSession(d)}
                  disabled={!d.online}
                  title={d.online ? 'Start an unattended session' : 'Device is offline'}
                >
                  Start
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={Trash2}
                  aria-label={`Remove ${d.label}`}
                  onClick={() => handleDelete(d._id)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register a device"
        description="Endpoints emit a fingerprint when the SabAssist agent is installed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegister} loading={submitting}>
              Register
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Label" required>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front-desk kiosk" />
          </Field>
          <Field label="Device fingerprint" required>
            <Input
              value={fingerprint}
              onChange={(e) => setFingerprint(e.target.value)}
              placeholder="Emitted by the SabAssist agent at install time"
            />
          </Field>
          <Field label="Agent version">
            <Input
              value={agentVersion}
              onChange={(e) => setAgentVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </Field>
          {error ? (
            <Alert tone="danger">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </Modal>
    </main>
  );
}
