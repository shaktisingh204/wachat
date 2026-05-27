'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Camera,
  CircleDot,
  Eraser,
  Flashlight,
  Hand,
  PencilLine,
  PhoneOff,
  Square,
  Type,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
  addSablensAnnotation,
  appendSablensActionLog,
  clearSablensAnnotations,
  endSablensSession,
  issueSablensCustomerToken,
  recordSablensSnapshot,
  sendSablensChat,
  startSablensSession,
} from '@/app/actions/sablens.actions';
import { MockTransport } from '@/lib/sablens/mock-transport';
import type {
  LensAnnotation,
  LensAnnotationKind,
  LensChatMessage,
  LensFrame,
} from '@/lib/sablens/transport';
import type {
  SablensAnnotationDoc,
  SablensAnnotationKind,
} from '@/lib/rust-client/sablens-annotations';
import type { SablensActionLogDoc } from '@/lib/rust-client/sablens-actions-log';
import type { SablensChatMessageDoc } from '@/lib/rust-client/sablens-chat';
import type { SablensSessionDoc } from '@/lib/rust-client/sablens-sessions';

import { AnnotationOverlay } from './annotation-overlay';

const TOOL_BUTTONS: {
  kind: LensAnnotationKind;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: 'arrow', label: 'Arrow', Icon: ArrowUpRight },
  { kind: 'rect', label: 'Rectangle', Icon: Square },
  { kind: 'circle', label: 'Circle', Icon: CircleDot },
  { kind: 'freehand', label: 'Freehand', Icon: PencilLine },
  { kind: 'text', label: 'Text', Icon: Type },
];

const COLORS = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ffffff'];

function annotationDocToLocal(doc: SablensAnnotationDoc): LensAnnotation {
  return {
    localId: doc._id,
    sessionId: doc.sessionId,
    ts: doc.ts ? new Date(doc.ts).getTime() : Date.now(),
    kind: doc.kind,
    geometry: doc.geometryJson,
    color: doc.color,
    strokeWidth: doc.strokeWidth,
    persistent: doc.persistent,
    authorKind: doc.authorUserId ? 'user' : 'guest',
  };
}

export interface TechnicianConsoleProps {
  session: SablensSessionDoc;
  initialAnnotations: SablensAnnotationDoc[];
  initialChat: SablensChatMessageDoc[];
  initialActionLog: SablensActionLogDoc[];
}

export function TechnicianConsole({
  session,
  initialAnnotations,
  initialChat,
  initialActionLog,
}: TechnicianConsoleProps) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const [tool, setTool] = useState<LensAnnotationKind | null>('arrow');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [currentFrame, setCurrentFrame] = useState<LensFrame | null>(null);
  const [annotations, setAnnotations] = useState<LensAnnotation[]>(
    initialAnnotations.map(annotationDocToLocal),
  );
  const [chat, setChat] = useState<SablensChatMessageDoc[]>(initialChat);
  const [log, setLog] = useState<SablensActionLogDoc[]>(initialActionLog);
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState(session.status);
  const [joinToken, setJoinToken] = useState(session.customerJoinToken);

  const transportRef = useRef<MockTransport | null>(null);

  useEffect(() => {
    const t = new MockTransport();
    transportRef.current = t;
    t.connectAsTechnician(session._id);
    const unsubFrame = t.subscribeFrames((f) => setCurrentFrame(f));
    const unsubAnn = t.subscribeAnnotations((a) => {
      // Avoid duplicating annotations the technician just published —
      // the publishing side echoes locally already.
      setAnnotations((prev) =>
        prev.some((p) => p.localId === a.localId) ? prev : [...prev, a],
      );
    });
    const unsubChat = t.subscribeChat((m: LensChatMessage) => {
      // Cosmetic preview — server persistence happens via sendSablensChat.
      if (m.senderKind === 'guest') {
        setChat((prev) => [
          ...prev,
          {
            _id: m.localId,
            sessionId: m.sessionId,
            ts: new Date(m.ts).toISOString(),
            senderKind: 'guest',
            body: m.body,
          },
        ]);
      }
    });
    return () => {
      unsubFrame();
      unsubAnn();
      unsubChat();
      t.disconnect();
    };
  }, [session._id]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  const handleCommit = useCallback(
    (a: Omit<LensAnnotation, 'localId' | 'ts'>) => {
      // Optimistic — push to the wire (echo + broadcast) and persist.
      transportRef.current?.publishAnnotation(a);
      startTransition(async () => {
        const res = await addSablensAnnotation({
          sessionId: session._id,
          kind: a.kind as SablensAnnotationKind,
          geometryJson: a.geometry,
          color: a.color,
          strokeWidth: a.strokeWidth,
          persistent: a.persistent,
        });
        if (!res.ok) {
          toast({ title: 'Could not save annotation', description: res.error });
        }
      });
    },
    [session._id, toast],
  );

  function handleStart() {
    startTransition(async () => {
      const res = await startSablensSession({ sessionId: session._id });
      if (!res.ok) {
        toast({ title: 'Could not start', description: res.error });
        return;
      }
      setStatus(res.data.status);
      toast({ title: 'Session active' });
    });
  }

  function handleEnd() {
    startTransition(async () => {
      const res = await endSablensSession(session._id);
      if (!res.ok) {
        toast({ title: 'Could not end', description: res.error });
        return;
      }
      setStatus(res.data.status);
      transportRef.current?.disconnect();
      toast({ title: 'Session ended' });
    });
  }

  function handleClearAnnotations() {
    startTransition(async () => {
      const res = await clearSablensAnnotations(session._id);
      if (!res.ok) {
        toast({ title: 'Could not clear', description: res.error });
        return;
      }
      setAnnotations([]);
    });
  }

  function handleReissueToken() {
    startTransition(async () => {
      const res = await issueSablensCustomerToken(session._id);
      if (!res.ok) {
        toast({ title: 'Could not mint token', description: res.error });
        return;
      }
      setJoinToken(res.data.customerJoinToken);
      toast({ title: 'New customer link minted' });
    });
  }

  function handleSnapshotPick(pick: SabFilePick) {
    startTransition(async () => {
      const res = await recordSablensSnapshot(session._id, pick.id, {
        capturedFrom: 'technician_upload',
      });
      if (!res.ok) {
        toast({ title: 'Could not record snapshot', description: res.error });
        return;
      }
      toast({ title: 'Snapshot saved' });
    });
  }

  function handleRequestSnapshot() {
    // Asks the customer end (over mock transport) to capture a frame.
    transportRef.current?.requestSnapshot();
    toast({ title: 'Snapshot requested' });
  }

  function handleTorchStub() {
    // Real flow would send a control message over WebRTC datachannel
    // asking the customer's WebView to toggle the torch via the
    // `ImageCapture` API. Stubbed for now.
    appendSablensActionLog({
      sessionId: session._id,
      action: 'elevate',
      payloadJson: { kind: 'torch_request' },
    });
    toast({ title: 'Torch request sent (stub)' });
  }

  function handleSendChat() {
    const body = chatInput.trim();
    if (!body) return;
    setChatInput('');
    transportRef.current?.sendChat({
      sessionId: session._id,
      body,
      senderKind: 'user',
    });
    startTransition(async () => {
      const res = await sendSablensChat({
        sessionId: session._id,
        body,
        senderKind: 'user',
      });
      if (res.ok) {
        setChat((prev) => [...prev, res.data]);
      } else {
        toast({ title: 'Could not send', description: res.error });
      }
    });
  }

  const customerUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/lens/${joinToken}`;
    return `${window.location.origin}/lens/${joinToken}`;
  }, [joinToken]);

  return (
    <div className="zoruui flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/sablens"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← All sessions
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {session.customerName || 'Untitled session'}
            </span>
            <span className="text-xs text-muted-foreground">
              {session.customerEmail || '—'}
            </span>
          </div>
          <Badge>{status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestSnapshot}
            disabled={status === 'ended'}
          >
            <Camera className="size-4" /> Capture snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={handleTorchStub}>
            <Flashlight className="size-4" /> Torch
          </Button>
          {status !== 'active' && status !== 'ended' && (
            <Button onClick={handleStart} disabled={isPending} size="sm">
              <Hand className="size-4" /> Start
            </Button>
          )}
          {status !== 'ended' && (
            <Button
              variant="destructive"
              onClick={handleEnd}
              disabled={isPending}
              size="sm"
            >
              <PhoneOff className="size-4" /> End session
            </Button>
          )}
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Viewport + toolbar */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Toolbar */}
          <Card>
            <ZoruCardContent className="flex flex-wrap items-center gap-2 p-3">
              {TOOL_BUTTONS.map(({ kind, label, Icon }) => (
                <Button
                  key={kind}
                  variant={tool === kind ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTool(tool === kind ? null : kind)}
                  aria-pressed={tool === kind}
                >
                  <Icon className="size-4" />
                  <span className="ml-1">{label}</span>
                </Button>
              ))}
              <Separator orientation="vertical" className="mx-1 h-6" />
              <div className="flex items-center gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2 transition"
                    style={{
                      background: c,
                      borderColor: color === c ? 'var(--zoru-ring, #000)' : 'transparent',
                    }}
                    aria-label={`Use color ${c}`}
                  />
                ))}
              </div>
              <div className="ml-2 flex items-center gap-2">
                <Label className="text-xs">Stroke</Label>
                <Select
                  value={String(strokeWidth)}
                  onValueChange={(v) => setStrokeWidth(Number(v))}
                >
                  <ZoruSelectTrigger className="h-8 w-20">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {[2, 3, 4, 6, 8, 12].map((w) => (
                      <ZoruSelectItem key={w} value={String(w)}>
                        {w} px
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={handleClearAnnotations}
                disabled={isPending}
              >
                <Eraser className="size-4" /> Clear
              </Button>
            </ZoruCardContent>
          </Card>

          {/* Camera viewport with SVG annotation overlay */}
          <Card className="relative flex-1 overflow-hidden bg-black">
            <div className="relative size-full">
              {currentFrame ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentFrame.imageUrl}
                  alt="Customer camera frame"
                  className="size-full object-contain"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-white/60">
                  Waiting for customer's camera feed…
                </div>
              )}
              <AnnotationOverlay
                sessionId={session._id}
                annotations={annotations}
                tool={tool}
                color={color}
                strokeWidth={strokeWidth}
                onCommit={handleCommit}
              />
            </div>
          </Card>

          {/* Customer link */}
          <Card>
            <ZoruCardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="text-muted-foreground">Customer link:</span>
              <code className="rounded bg-muted px-2 py-1 text-xs">{customerUrl}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(customerUrl);
                  toast({ title: 'Link copied' });
                }}
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReissueToken}
                disabled={isPending}
              >
                Re-issue token
              </Button>
              <SabFilePickerButton
                accept="image"
                onPick={handleSnapshotPick}
                variant="outline"
              >
                Upload snapshot
              </SabFilePickerButton>
            </ZoruCardContent>
          </Card>
        </div>

        {/* Right panel — chat + log */}
        <Card className="flex min-h-0 flex-col">
          <ZoruCardHeader className="p-3">
            <ZoruCardTitle className="text-sm">Activity</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0">
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border bg-muted/30 p-2">
              {log.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                log.map((l) => (
                  <div
                    key={l._id}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    <span className="font-semibold">{l.action}</span>{' '}
                    <span className="text-muted-foreground">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Separator />

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded border bg-muted/30 p-2">
              {chat.length === 0 ? (
                <p className="text-xs text-muted-foreground">No chat yet.</p>
              ) : (
                chat.map((m) => (
                  <div
                    key={m._id}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    <span className="font-semibold">
                      {m.senderKind === 'guest' ? 'Customer' : 'You'}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(m.ts).toLocaleTimeString()}
                    </span>
                    <p className="mt-1">{m.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={chatInput}
                placeholder="Send a message…"
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
              />
              <Button onClick={handleSendChat} disabled={!chatInput.trim()}>
                Send
              </Button>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </div>
  );
}
