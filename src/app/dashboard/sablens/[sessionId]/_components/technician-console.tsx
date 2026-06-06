'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  CircleDot,
  Eraser,
  Flashlight,
  Hand,
  MessageSquare,
  PencilLine,
  PhoneOff,
  Square,
  Type,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  useToast,
} from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();
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
      // Avoid duplicating annotations the technician just published.
      // The publishing side echoes locally already.
      setAnnotations((prev) =>
        prev.some((p) => p.localId === a.localId) ? prev : [...prev, a],
      );
    });
    const unsubChat = t.subscribeChat((m: LensChatMessage) => {
      // Cosmetic preview. Server persistence happens via sendSablensChat.
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
      // Optimistic. Push to the wire (echo + broadcast) and persist.
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
          toast({ title: 'Could not save annotation', description: res.error, tone: 'danger' });
        }
      });
    },
    [session._id, toast],
  );

  function handleStart() {
    startTransition(async () => {
      const res = await startSablensSession({ sessionId: session._id });
      if (!res.ok) {
        toast({ title: 'Could not start', description: res.error, tone: 'danger' });
        return;
      }
      setStatus(res.data.status);
      toast({ title: 'Session active', tone: 'success' });
    });
  }

  function handleEnd() {
    startTransition(async () => {
      const res = await endSablensSession(session._id);
      if (!res.ok) {
        toast({ title: 'Could not end', description: res.error, tone: 'danger' });
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
        toast({ title: 'Could not clear', description: res.error, tone: 'danger' });
        return;
      }
      setAnnotations([]);
    });
  }

  function handleReissueToken() {
    startTransition(async () => {
      const res = await issueSablensCustomerToken(session._id);
      if (!res.ok) {
        toast({ title: 'Could not mint token', description: res.error, tone: 'danger' });
        return;
      }
      setJoinToken(res.data.customerJoinToken);
      toast({ title: 'New customer link minted', tone: 'success' });
    });
  }

  function handleSnapshotPick(pick: SabFilePick) {
    startTransition(async () => {
      const res = await recordSablensSnapshot(session._id, pick.id, {
        capturedFrom: 'technician_upload',
      });
      if (!res.ok) {
        toast({ title: 'Could not record snapshot', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Snapshot saved', tone: 'success' });
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
        toast({ title: 'Could not send', description: res.error, tone: 'danger' });
      }
    });
  }

  const customerUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/lens/${joinToken}`;
    return `${window.location.origin}/lens/${joinToken}`;
  }, [joinToken]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/sablens"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)] hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All sessions
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--st-text)]">
              {session.customerName || 'Untitled session'}
            </span>
            <span className="text-xs text-[var(--st-text-secondary)]">
              {session.customerEmail || 'No email on file'}
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
            iconLeft={Camera}
          >
            Capture snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={handleTorchStub} iconLeft={Flashlight}>
            Torch
          </Button>
          {status !== 'active' && status !== 'ended' && (
            <Button onClick={handleStart} disabled={isPending} size="sm" iconLeft={Hand}>
              Start
            </Button>
          )}
          {status !== 'ended' && (
            <Button
              variant="danger"
              onClick={handleEnd}
              disabled={isPending}
              size="sm"
              iconLeft={PhoneOff}
            >
              End session
            </Button>
          )}
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Viewport + toolbar */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Toolbar */}
          <Card padding="none">
            <CardBody className="flex flex-wrap items-center gap-2 p-3">
              {TOOL_BUTTONS.map(({ kind, label, Icon }) => (
                <Button
                  key={kind}
                  variant={tool === kind ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setTool(tool === kind ? null : kind)}
                  aria-pressed={tool === kind}
                  iconLeft={Icon}
                >
                  {label}
                </Button>
              ))}
              <Separator orientation="vertical" className="mx-1 h-6" />
              <div className="flex items-center gap-1.5" role="group" aria-label="Annotation color">
                {COLORS.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant="ghost"
                    onClick={() => setColor(c)}
                    aria-pressed={color === c}
                    aria-label={`Use color ${c}`}
                    className="size-6 rounded-full p-0"
                    style={{
                      // Runtime-computed: the swatch reflects a user-picked color.
                      background: c,
                      boxShadow:
                        color === c
                          ? '0 0 0 2px var(--st-bg), 0 0 0 4px var(--st-accent)'
                          : 'inset 0 0 0 1px var(--st-border)',
                    }}
                  />
                ))}
              </div>
              <div className="ml-2 flex items-center gap-2">
                <Label className="text-xs">Stroke</Label>
                <Select
                  value={String(strokeWidth)}
                  onValueChange={(v) => setStrokeWidth(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20" aria-label="Stroke width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 6, 8, 12].map((w) => (
                      <SelectItem key={w} value={String(w)}>
                        {w} px
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={handleClearAnnotations}
                disabled={isPending}
                iconLeft={Eraser}
              >
                Clear
              </Button>
            </CardBody>
          </Card>

          {/* Camera viewport with SVG annotation overlay */}
          <Card padding="none" className="relative flex-1 overflow-hidden bg-black">
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
                  Waiting for the customer&apos;s camera feed...
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
          <Card padding="none">
            <CardBody className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="text-[var(--st-text-secondary)]">Customer link:</span>
              <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-2 py-1 text-xs text-[var(--st-text)]">
                {customerUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(customerUrl);
                  toast({ title: 'Link copied', tone: 'success' });
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
            </CardBody>
          </Card>
        </div>

        {/* Right panel: chat + log */}
        <Card padding="none" className="flex min-h-0 flex-col">
          <CardHeader className="p-3">
            <CardTitle className="text-sm">Activity</CardTitle>
          </CardHeader>
          <CardBody className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0">
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
              {log.length === 0 ? (
                <EmptyState size="sm" title="No activity yet." />
              ) : (
                log.map((l) => (
                  <div
                    key={l._id}
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1 text-xs"
                  >
                    <span className="font-semibold text-[var(--st-text)]">{l.action}</span>{' '}
                    <span className="text-[var(--st-text-secondary)]">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Separator />

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
              {chat.length === 0 ? (
                <EmptyState size="sm" icon={MessageSquare} title="No chat yet." />
              ) : (
                chat.map((m) => (
                  <div
                    key={m._id}
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1 text-xs"
                  >
                    <span className="font-semibold text-[var(--st-text)]">
                      {m.senderKind === 'guest' ? 'Customer' : 'You'}
                    </span>
                    <span className="ml-2 text-[var(--st-text-secondary)]">
                      {new Date(m.ts).toLocaleTimeString()}
                    </span>
                    <p className="mt-1 text-[var(--st-text)]">{m.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2">
              <Field label="Message" className="flex-1">
                <Input
                  value={chatInput}
                  placeholder="Send a message..."
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                />
              </Field>
              <Button onClick={handleSendChat} disabled={!chatInput.trim()}>
                Send
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
