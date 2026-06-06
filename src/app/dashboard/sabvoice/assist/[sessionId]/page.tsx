'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  Input,
  Label,
  Alert,
  ZoruAlertDescription,
} from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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
      <EntityListShell title="Loading…" loading>
        <span />
      </EntityListShell>
    );
  }

  return (
    <EntityListShell
      title={
        session.customerName ||
        session.customerEmail ||
        'SabAssist technician console'
      }
      subtitle={`Mode: ${session.mode} · Status: ${session.status}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/sabvoice/assist"
          className="text-sm text-[var(--st-text-secondary)] inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> All sessions
        </Link>
        <div className="flex items-center gap-2">
          {session.status === 'active' && <Badge variant="default">Active</Badge>}
          {session.status === 'scheduled' && <Badge variant="outline">Scheduled</Badge>}
          {session.status === 'ended' && <Badge variant="secondary">Ended</Badge>}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4">
          <div className="aspect-video bg-[var(--st-bg-muted)] rounded-lg border border-[var(--st-border)] flex items-center justify-center text-[var(--st-text-secondary)]">
            {streaming ? (
              <div className="flex flex-col items-center gap-2">
                <ScreenShare className="h-12 w-12 text-[var(--st-accent)]" />
                <div className="font-medium">Live (mock) — customer screen</div>
                <div className="text-xs">
                  Replace with WebRTC &lt;video&gt; when the real transport ships.
                </div>
              </div>
            ) : (
              <div className="text-center">
                <ScreenShare className="h-12 w-12 mx-auto opacity-50" />
                <div className="mt-2">Not streaming.</div>
                <div className="text-xs">Click &ldquo;Start&rdquo; to request the customer screen.</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {streaming ? (
              <Button variant="outline" onClick={handleStop}>
                <PowerOff className="h-4 w-4 mr-1" /> Stop stream
              </Button>
            ) : (
              <Button onClick={handleStart}>
                <Power className="h-4 w-4 mr-1" /> Start
              </Button>
            )}
            <Button variant="outline" onClick={() => handleAnnotation('pen')}>
              <Pen className="h-4 w-4 mr-1" /> Pen
            </Button>
            <Button variant="outline" onClick={() => handleAnnotation('arrow')}>
              <ArrowUpRight className="h-4 w-4 mr-1" /> Arrow
            </Button>
            <Button variant="outline" onClick={() => handleAnnotation('highlight')}>
              <Highlighter className="h-4 w-4 mr-1" /> Highlight
            </Button>
            <Button variant="outline" onClick={() => handleAnnotation('erase')}>
              <Eraser className="h-4 w-4 mr-1" /> Erase
            </Button>
            <Button variant="outline" onClick={handleFileTransfer}>
              <Upload className="h-4 w-4 mr-1" /> File transfer
            </Button>
            <Button variant="outline" onClick={handleElevate}>
              <ShieldAlert className="h-4 w-4 mr-1" /> Elevate
            </Button>
            <Button variant="outline" onClick={handleReboot}>
              <RefreshCw className="h-4 w-4 mr-1" /> Reboot request
            </Button>
            <div className="flex-1" />
            <Button variant="destructive" onClick={handleEnd}>
              End session
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-medium mb-2">Action log</div>
          {actions.length === 0 ? (
            <div className="text-sm text-[var(--st-text-secondary)]">No actions yet.</div>
          ) : (
            <ol className="text-sm space-y-2 max-h-[480px] overflow-y-auto">
              {actions.map((a) => (
                <li key={a._id} className="border-l-2 border-[var(--st-border)] pl-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{a.action}</Badge>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(a.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {a.payloadJson != null && (
                    <pre className="text-xs text-[var(--st-text-secondary)] mt-1 whitespace-pre-wrap">
                      {JSON.stringify(a.payloadJson, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <div className="font-medium mb-1">Session metadata</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--st-text-secondary)]">Customer</dt>
          <dd>{session.customerName || session.customerEmail || '—'}</dd>
          <dt className="text-[var(--st-text-secondary)]">Mode</dt>
          <dd>{session.mode}</dd>
          <dt className="text-[var(--st-text-secondary)]">Linked call</dt>
          <dd>
            {session.callId ? (
              <Link
                href={`/dashboard/sabvoice/calls`}
                className="text-[var(--st-accent)]"
              >
                {session.callId}
              </Link>
            ) : (
              '—'
            )}
          </dd>
          <dt className="text-[var(--st-text-secondary)]">Started</dt>
          <dd>{session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'}</dd>
        </dl>
      </Card>
    </EntityListShell>
  );
}
