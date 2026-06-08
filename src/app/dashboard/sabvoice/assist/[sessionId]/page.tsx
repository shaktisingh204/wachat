'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  ScreenShare,
  ArrowLeft,
  Pen,
  ArrowUpRight,
  Highlighter,
  Eraser,
  Power,
  PowerOff,
  Upload,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import {
  getSabassistSession,
  endSabassistSession,
  startSabassistSession,
  listSabassistActions,
  logSabassistAction,
  type SabassistActionKind,
} from '@/app/actions/sabassist.actions';
import {
  createAssistTransport,
  type IAssistTransport,
  type AnnotationKind,
} from '@/lib/sabassist/transport';

type SessionDoc = {
  _id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  mode: 'attended' | 'unattended';
  status: 'scheduled' | 'active' | 'ended';
  callId?: string | null;
  startedAt?: string | null;
  durationSecs?: number | null;
};

type ActionRow = {
  _id: string;
  ts: string;
  action: SabassistActionKind;
  payloadJson?: unknown;
};

const STATUS_TONE: Record<SessionDoc['status'], React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  scheduled: 'info',
  ended: 'neutral',
};

export default function SabassistTechnicianConsolePage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = React.useState<SessionDoc | null>(null);
  const [actions, setActions] = React.useState<ActionRow[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Transport is stable for the lifetime of the page. We instantiate once.
  const transportRef = React.useRef<IAssistTransport | null>(null);
  if (transportRef.current === null) {
    transportRef.current = createAssistTransport();
  }

  const reload = React.useCallback(async () => {
    const [s, a] = await Promise.all([
      getSabassistSession(sessionId),
      listSabassistActions(sessionId, 200),
    ]);
    if (s.success) setSession(s.data as SessionDoc);
    if (a.success) setActions(a.data as ActionRow[]);
  }, [sessionId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    const t = transportRef.current;
    if (!t) return;
    const unsub = t.on((event) => {
      if (event.type === 'stream_started') setStreaming(true);
      if (event.type === 'stream_stopped') setStreaming(false);
    });
    return unsub;
  }, []);

  const recordAction = React.useCallback(
    async (action: SabassistActionKind, payloadJson?: unknown) => {
      try {
        await logSabassistAction({ sessionId, action, payloadJson });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload, sessionId],
  );

  const handleStart = async () => {
    setError(null);
    try {
      if (session?.status !== 'active') {
        await startSabassistSession({ sessionId });
      }
      const t = transportRef.current!;
      await t.startScreenShare();
      await recordAction('connect', { via: 'console' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStop = async () => {
    setError(null);
    try {
      const t = transportRef.current!;
      await t.stopScreenShare();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleEnd = async () => {
    setError(null);
    try {
      const t = transportRef.current!;
      await t.disconnect();
      await endSabassistSession(sessionId);
      router.push('/dashboard/sabvoice/assist');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAnnotation = async (kind: AnnotationKind) => {
    const t = transportRef.current!;
    const payload = { kind, x: 0.5, y: 0.5, color: '#ff5252', strokeWidth: 2 };
    await t.sendAnnotation(payload);
    await recordAction('annotation', payload);
  };

  const handleFileTransfer = async () => {
    const t = transportRef.current!;
    const payload = {
      direction: 'technician_to_customer' as const,
      fileName: 'pending-from-sabfiles.bin',
      note: 'Replace with a SabFile picker on the next pass.',
    };
    const r = await t.requestFileTransfer(payload);
    await recordAction('file_transfer', { ...payload, transferId: r.transferId });
  };

  const handleElevate = async () => {
    await recordAction('elevate', { target: 'admin', via: 'console' });
  };

  const handleReboot = async () => {
    await recordAction('reboot_request', { confirm: true });
  };

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-3">
          <Skeleton className="h-80 w-full lg:col-span-2" />
          <Skeleton className="h-80 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Technician console</PageEyebrow>
          <PageTitle>
            {session.customerName || session.customerEmail || 'SabAssist session'}
          </PageTitle>
          <PageDescription>
            Mode: <span className="capitalize">{session.mode}</span>
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Badge tone={STATUS_TONE[session.status]} className="capitalize">
            {session.status}
          </Badge>
          <Button asChild variant="ghost">
            <Link href="/dashboard/sabvoice/assist">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              All sessions
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <Alert tone="danger" onClose={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-3">
        <Card variant="outlined" className="lg:col-span-2">
          <div className="flex aspect-video items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            {streaming ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <ScreenShare className="h-12 w-12 text-[var(--st-accent)]" aria-hidden="true" />
                <div className="font-medium text-[var(--st-text)]">Live — customer screen</div>
                <div className="text-xs">WebRTC video renders here once the transport ships.</div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <ScreenShare className="h-12 w-12 opacity-50" aria-hidden="true" />
                <div className="font-medium text-[var(--st-text)]">Not streaming</div>
                <div className="text-xs">Start to request the customer screen.</div>
              </div>
            )}
          </div>

          <div className="mt-[var(--st-space-4)] flex flex-wrap gap-2">
            {streaming ? (
              <Button variant="outline" iconLeft={PowerOff} onClick={handleStop}>
                Stop stream
              </Button>
            ) : (
              <Button variant="primary" iconLeft={Power} onClick={handleStart}>
                Start
              </Button>
            )}
            <Button variant="outline" iconLeft={Pen} onClick={() => handleAnnotation('pen')}>
              Pen
            </Button>
            <Button variant="outline" iconLeft={ArrowUpRight} onClick={() => handleAnnotation('arrow')}>
              Arrow
            </Button>
            <Button variant="outline" iconLeft={Highlighter} onClick={() => handleAnnotation('highlight')}>
              Highlight
            </Button>
            <Button variant="outline" iconLeft={Eraser} onClick={() => handleAnnotation('erase')}>
              Erase
            </Button>
            <Button variant="outline" iconLeft={Upload} onClick={handleFileTransfer}>
              File transfer
            </Button>
            <Button variant="outline" iconLeft={ShieldAlert} onClick={handleElevate}>
              Elevate
            </Button>
            <Button variant="outline" iconLeft={RefreshCw} onClick={handleReboot}>
              Reboot request
            </Button>
            <div className="flex-1" />
            <Button variant="danger" onClick={handleEnd}>
              End session
            </Button>
          </div>
        </Card>

        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Action log</CardTitle>
          </CardHeader>
          {actions.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No actions recorded yet.</p>
          ) : (
            <ol className="max-h-[480px] space-y-2 overflow-y-auto text-sm">
              {actions.map((a) => (
                <li key={a._id} className="border-l-2 border-[var(--st-border)] pl-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral" kind="outline">
                      {a.action}
                    </Badge>
                    <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                      {new Date(a.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {a.payloadJson != null ? (
                    <pre className="mt-1 whitespace-pre-wrap text-xs text-[var(--st-text-tertiary)]">
                      {JSON.stringify(a.payloadJson, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>Session details</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-[var(--st-border)] py-1">
            <dt className="text-[var(--st-text-secondary)]">Customer</dt>
            <dd className="text-[var(--st-text)]">
              {session.customerName || session.customerEmail || 'n/a'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--st-border)] py-1">
            <dt className="text-[var(--st-text-secondary)]">Mode</dt>
            <dd className="capitalize text-[var(--st-text)]">{session.mode}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--st-border)] py-1">
            <dt className="text-[var(--st-text-secondary)]">Linked call</dt>
            <dd>
              {session.callId ? (
                <Link href="/dashboard/sabvoice/calls" className="text-[var(--st-accent)]">
                  {session.callId}
                </Link>
              ) : (
                <span className="text-[var(--st-text)]">n/a</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--st-border)] py-1">
            <dt className="text-[var(--st-text-secondary)]">Started</dt>
            <dd className="tabular-nums text-[var(--st-text)]">
              {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'not started'}
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
