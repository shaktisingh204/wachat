'use client';

import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  CloudOff,
  LoaderCircle,
  PlayCircle,
  Rocket,
  Workflow,
  } from 'lucide-react';

import {
  getTelegramFlow,
  publishTelegramFlow,
  testTelegramFlow,
  updateTelegramFlow,
  } from '@/app/actions/telegram-flows.actions';
import type {
  FlowEdge,
  FlowNode,
  FlowRow,
  FlowTrigger,
  ValidationError,
  } from '@/lib/rust-client/telegram-flows';
import { useProject } from '@/context/project-context';

/**
 * Top-level Telegram flow editor.
 *
 * Layout:
 *   [ top bar: name / status / version / Test / Publish / save indicator ]
 *   [ canvas + node palette on the left | inspector panel on the right    ]
 *   [ run log strip on the bottom                                         ]
 *
 * Behaviour:
 *   - Auto-save: any change to `name`, `description`, `trigger`, `nodes`, or
 *     `edges` schedules a debounced PUT (1 s). The indicator switches between
 *     "saved", "saving", and "unsaved" so the user always knows the state.
 *   - Publish: posts to `/publish`, surfaces validation errors inline.
 *   - Test: opens a side drawer to set up a simulated message and shows the
 *     returned step trace.
 *   - Published flows are rendered read-only (the API enforces this too).
 */

import { cn } from '@/lib/utils';

import { FlowCanvas } from './FlowCanvas';
import { FlowInspectorPanel } from './FlowInspectorPanel';
import { FlowRunLogPanel } from './FlowRunLogPanel';

const ACCENT = '#229ED9';
const SAVE_DEBOUNCE_MS = 1000;

type SaveState = 'saved' | 'saving' | 'unsaved';

type Props = { flowId: string };

export function FlowEditorShell({ flowId }: Props) {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();

  const [flow, setFlow] = useState<FlowRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [runRefreshKey, setRunRefreshKey] = useState(0);
  const [testOpen, setTestOpen] = useState(false);

  // Refs so the debounced save callback always sees the latest state without
  // re-creating itself on every keystroke.
  const flowRef = useRef<FlowRow | null>(null);
  flowRef.current = flow;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── initial load ────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!activeProjectId) return;
    startLoading(async () => {
      const res = await getTelegramFlow(flowId, activeProjectId);
      if (res.error || !res.flow) {
        setLoadError(res.error ?? 'Flow not found.');
        return;
      }
      setFlow(res.flow);
    });
  }, [activeProjectId, flowId]);

  /* ── auto-save plumbing ──────────────────────────────────────────────── */

  const scheduleSave = useCallback(() => {
    if (!activeProjectId) return;
    setSaveState('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const current = flowRef.current;
      if (!current || current.status === 'published') return;
      setSaveState('saving');
      const res = await updateTelegramFlow(current._id, {
        projectId: activeProjectId,
        name: current.name,
        description: current.description,
        trigger: current.trigger,
        nodes: current.nodes,
        edges: current.edges,
      });
      if (!res.success) {
        setSaveState('unsaved');
        toast({
          title: 'Auto-save failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setSaveState('saved');
    }, SAVE_DEBOUNCE_MS);
  }, [activeProjectId, toast]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /* ── mutators (every patch schedules a save) ─────────────────────────── */

  const patchFlow = useCallback(
    (p: Partial<FlowRow>) => {
      setFlow((prev) => (prev ? { ...prev, ...p } : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleChangeNodes = (next: FlowNode[]) => patchFlow({ nodes: next });
  const handleChangeEdges = (next: FlowEdge[]) => patchFlow({ edges: next });
  const handleChangeTrigger = (next: FlowTrigger) => patchFlow({ trigger: next });

  const handleChangeNode = (node: FlowNode) => {
    if (!flow) return;
    const next = flow.nodes.map((n) => (n.id === node.id ? node : n));
    patchFlow({ nodes: next });
  };

  const handleDeleteNode = () => {
    if (!flow || !selectedNodeId) return;
    patchFlow({
      nodes: flow.nodes.filter((n) => n.id !== selectedNodeId),
      edges: flow.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    });
    setSelectedNodeId(null);
  };

  /* ── publish ─────────────────────────────────────────────────────────── */

  const [isPublishing, startPublishing] = useTransition();
  const handlePublish = () => {
    if (!flow || !activeProjectId) return;
    setValidationErrors([]);
    startPublishing(async () => {
      const res = await publishTelegramFlow(flow._id, activeProjectId);
      if (!res.success) {
        setValidationErrors(res.validationErrors ?? []);
        toast({
          title: 'Publish failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Flow published' });
      // Re-fetch so version/status reflect the publish.
      const fresh = await getTelegramFlow(flow._id, activeProjectId);
      if (fresh.flow) setFlow(fresh.flow);
    });
  };

  /* ── test ────────────────────────────────────────────────────────────── */

  const handleTest = (simulated: { text?: string; command?: string; callbackData?: string }) => {
    if (!flow || !activeProjectId) return;
    startPublishing(async () => {
      const res = await testTelegramFlow(flow._id, {
        projectId: activeProjectId,
        simulatedMessage: simulated,
      });
      if (!res.success) {
        toast({ title: 'Test failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Test complete',
        description: `${res.steps.length} step${res.steps.length === 1 ? '' : 's'} executed`,
      });
      setRunRefreshKey((k) => k + 1);
      setTestOpen(false);
    });
  };

  /* ── derived ─────────────────────────────────────────────────────────── */

  const selectedNode = useMemo(
    () => flow?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [flow, selectedNodeId],
  );

  const readOnly = flow?.status === 'published';

  /* ── render ──────────────────────────────────────────────────────────── */

  if (isLoading && !flow) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading flow…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Workflow className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{loadError}</p>
        <Button variant="secondary" onClick={() => router.push('/dashboard/telegram/flows')}>
          <ArrowLeft className="h-4 w-4" /> Back to flows
        </Button>
      </div>
    );
  }

  if (!flow) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/telegram/flows')}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Workflow className="h-5 w-5" style={{ color: ACCENT }} />
        <input
          aria-label="Flow name"
          className="rounded border border-transparent bg-transparent px-2 py-1 text-base font-semibold outline-none hover:border-border focus:border-primary"
          value={flow.name}
          onChange={(e) => patchFlow({ name: e.target.value })}
          disabled={readOnly}
        />
        <Badge variant={readOnly ? 'default' : 'secondary'}>{flow.status}</Badge>
        <span className="text-xs text-muted-foreground">
          v{flow.version}
          {flow.latestPublishedVersion > 0 ? ` · published v${flow.latestPublishedVersion}` : ''}
        </span>
        <SaveIndicator state={saveState} readOnly={readOnly} />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setTestOpen(true)} disabled={isPublishing}>
            <PlayCircle className="h-4 w-4" /> Test
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing || readOnly}>
            {isPublishing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            Publish
          </Button>
        </div>
      </header>

      {/* Validation banner */}
      {validationErrors.length > 0 ? (
        <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <p className="font-semibold">Cannot publish — fix the following:</p>
          <ul className="ml-4 list-disc">
            {validationErrors.map((e, i) => (
              <li key={`${e.field}-${i}`}>
                <code className="font-mono">{e.field}</code>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Description */}
      <div className="border-b bg-muted/30 px-4 py-2">
        <Input
          aria-label="Flow description"
          placeholder="Description (optional)"
          value={flow.description}
          onChange={(e) => patchFlow({ description: e.target.value })}
          disabled={readOnly}
          className="border-transparent bg-transparent text-xs focus:border-border"
        />
      </div>

      {/* Canvas + inspector */}
      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative overflow-hidden">
          <FlowCanvas
            nodes={flow.nodes}
            edges={flow.edges}
            trigger={flow.trigger}
            selectedId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onChangeNodes={handleChangeNodes}
            onChangeEdges={handleChangeEdges}
            disabled={readOnly}
          />
        </div>
        <aside className="overflow-y-auto border-l bg-background">
          <FlowInspectorPanel
            selectedNode={selectedNode}
            trigger={flow.trigger}
            onChangeTrigger={handleChangeTrigger}
            onChangeNode={handleChangeNode}
            onDeleteNode={handleDeleteNode}
            disabled={readOnly}
          />
        </aside>
      </div>

      {/* Run log */}
      <div className="border-t p-3">
        <FlowRunLogPanel
          flowId={flow._id}
          projectId={activeProjectId ?? ''}
          refreshKey={runRefreshKey}
        />
      </div>

      {/* Test drawer */}
      <TestDrawer
        open={testOpen}
        onOpenChange={setTestOpen}
        onRun={handleTest}
        isRunning={isPublishing}
      />
    </div>
  );
}

/* ── save indicator ────────────────────────────────────────────────────── */

function SaveIndicator({ state, readOnly }: { state: SaveState; readOnly?: boolean }) {
  if (readOnly) {
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CloudOff className="h-3 w-3" /> Read-only
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <LoaderCircle className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === 'unsaved') {
    return (
      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
        <CloudOff className="h-3 w-3" /> Unsaved
      </span>
    );
  }
  return (
    <span className={cn('ml-2 inline-flex items-center gap-1 text-xs text-emerald-600')}>
      <Cloud className="h-3 w-3" /> Saved
      <CheckCircle2 className="h-3 w-3" />
    </span>
  );
}

/* ── test drawer ───────────────────────────────────────────────────────── */

function TestDrawer({
  open,
  onOpenChange,
  onRun,
  isRunning,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRun: (m: { text?: string; command?: string; callbackData?: string }) => void;
  isRunning: boolean;
}) {
  const [text, setText] = useState('hello');
  const [command, setCommand] = useState('');
  const [callback, setCallback] = useState('');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ZoruSheetContent className="flex flex-col gap-4">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Test flow</ZoruSheetTitle>
          <ZoruSheetDescription>
            Simulates a message against this flow — no Telegram side effects. The trace
            shows which nodes would run.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="td-text">Message text</Label>
            <Textarea
              id="td-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="td-command">Command (without /)</Label>
            <Input
              id="td-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="start"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="td-callback">Callback data</Label>
            <Input
              id="td-callback"
              value={callback}
              onChange={(e) => setCallback(e.target.value)}
              placeholder="opt_a"
            />
          </div>
        </div>

        <ZoruSheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Close
          </Button>
          <Button
            onClick={() =>
              onRun({
                text: text || undefined,
                command: command || undefined,
                callbackData: callback || undefined,
              })
            }
            disabled={isRunning}
          >
            {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run test
          </Button>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </Sheet>
  );
}

