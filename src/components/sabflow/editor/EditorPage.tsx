'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { GraphProvider, useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { GraphDndProvider } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { WorkflowCanvas } from '@/components/sabflow/canvas/WorkflowCanvas';
import { BlocksSideBar } from './BlocksSideBar';
import { BlockCardOverlay } from './BlockCardOverlay';
import { BlockSettingsPanel } from '@/components/sabflow/panels/BlockSettingsPanel';
import { FlowSettingsPanel } from './FlowSettingsPanel';
import { FlowPreviewPanel } from './FlowPreviewPanel';
import { VariablesPanel } from '@/components/sabflow/panels/VariablesPanel';
import { ThemePanel } from '@/components/sabflow/panels/ThemePanel';
import { VersionHistoryPanel } from '@/components/sabflow/panels/VersionHistoryPanel';
import { FlowEditorHeader } from './FlowEditorHeader';
import { ValidationPanel } from '@/components/sabflow/panels/ValidationPanel';
import {
  CollabProvider,
  CollabAvatarStack,
  CollabRemoteCursors,
} from './chrome/EditorCollabMount';
import { saveSabFlow, activateSabFlow, deactivateSabFlow } from '@/app/actions/sabflow';
import { toJsonSafe } from '@/lib/sabflow/toJsonSafe';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { countValidationResults } from '@/lib/sabflow/validation';
import type { ValidationError } from '@/lib/sabflow/validation';
import { cn } from '@/lib/utils';
import {
  LuSettings,
  LuPlay,
  LuVariable,
  LuPalette,
  LuHistory,
  LuLink,
  LuCopy,
  LuX,
} from 'react-icons/lu';

/* ── Constants ───────────────────────────────────────────────────────────── */

const MAX_HISTORY = 50;

/**
 * Phase C.8.1 feature flag — when truthy, the editor swaps its in-memory
 * `useState(initialFlow)` for `useSabFlowDoc(flowId)` and rewires every
 * mutation handler to a Yjs transaction. Default is OFF so production keeps
 * the legacy REST-save path; the CRDT path lands behind this flag per the
 * rollback plan in `docs/adr/sabflow-state-management.md` §4.1.
 *
 * `NEXT_PUBLIC_*` env vars are inlined at build time — this expression
 * collapses to a literal boolean and the legacy branch tree-shakes cleanly
 * when the flag is unset.
 */
const COLLAB_FLAG_RAW = process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED;
const SABFLOW_COLLAB_ENABLED =
  COLLAB_FLAG_RAW === '1' ||
  COLLAB_FLAG_RAW === 'true' ||
  COLLAB_FLAG_RAW === 'TRUE';

/* ── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  flow: SabFlowDoc & { _id: string };
};

type RightPanel = 'settings' | 'preview' | 'variables' | 'theme' | 'validation' | 'versions' | null;

/* ── Lazy collab branch (only loaded when the flag is on) ────────────────── */

/**
 * The collab branch is dynamically imported so its dependency chain (Yjs,
 * `useSabFlowDoc`, `SabFlowUndoManager`) is excluded from the bundle when
 * the flag is off. `ssr: false` is required because the underlying hook
 * opens a WebSocket and reads `window`.
 */
const EditorContentCollab = dynamic(
  () => import('./EditorContentCollab').then((m) => m.EditorContentCollab),
  { ssr: false },
);

/* ── EditorContent (must be inside GraphProvider) ────────────────────────── */

function EditorContent({ flow: initialFlow }: Props) {
  const [flow, setFlow] = useState(initialFlow);
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>(null);
  const [validationResults, setValidationResults] = useState<ValidationError[]>([]);
  const [webhookBanner, setWebhookBanner] = useState<Array<{ appEvent: string; webhookId: string; webhookUrl: string }> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setOpenedNodeId } = useGraph();

  /* ── Undo / Redo history ─────────────────────────────────────────────── */

  // history[historyIndex] is always the current state.
  // Anything after historyIndex has been undone and can be redone.
  const [history, setHistory] = useState<Array<SabFlowDoc & { _id: string }>>([initialFlow]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  /** Push a new snapshot onto the history stack (trim future, cap at MAX_HISTORY). */
  const pushHistory = useCallback(
    (snapshot: SabFlowDoc & { _id: string }) => {
      setHistory((prev) => {
        const trunk = prev.slice(0, historyIndex + 1);
        const next = [...trunk, snapshot];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
    },
    [historyIndex],
  );

  const undo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setFlow(history[newIndex]);
  }, [canUndo, historyIndex, history]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setFlow(history[newIndex]);
  }, [canRedo, historyIndex, history]);

  // When a toolbar panel is opened, close any open block node
  const togglePanel = useCallback((panel: Exclude<RightPanel, null>) => {
    setActivePanel((prev) => {
      if (prev === panel) return null;
      setOpenedNodeId(undefined);
      return panel;
    });
  }, [setOpenedNodeId]);

  /* ── Validation focus handler ────────────────────────────────────────── */

  const handleFocusBlock = useCallback(
    (groupId: string, blockId?: string) => {
      // Open the block settings panel for the given block if a blockId is provided.
      // GraphProvider's setOpenedNodeId uses the block id as the "node id".
      if (blockId) setOpenedNodeId(blockId);
      // Close the validation panel so the user can see the canvas
      setActivePanel(null);
    },
    [setOpenedNodeId],
  );

  /* ── Flow change handler (passed down to Graph) ──────────────────────── */

  const handleFlowChange = useCallback(
    (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => {
      setFlow((prev) => {
        const next = { ...prev, ...changes };
        pushHistory(next);
        return next;
      });
    },
    [pushHistory],
  );

  /**
   * Full-document replace — used by the n8n-style WorkflowCanvas, which
   * returns the entire next SabFlowDoc rather than a diff patch. We preserve
   * the mongo _id so downstream saves still target the right record.
   */
  const handleDocChange = useCallback(
    (next: SabFlowDoc) => {
      setFlow((prev) => {
        const merged = { ...next, _id: prev._id } as SabFlowDoc & { _id: string };
        pushHistory(merged);
        return merged;
      });
    },
    [pushHistory],
  );

  /* ── Name change (from header) ───────────────────────────────────────── */

  const handleNameChange = useCallback((name: string) => {
    setFlow((prev) => {
      const next = { ...prev, name };
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  /* ── Save ────────────────────────────────────────────────────────────── */

  const save = useCallback(
    (overrides?: Partial<SabFlowDoc>) => {
      setSaveError(null);
      // Defensively unwrap callers like `onClick={save}` that pass a
      // SyntheticEvent — spreading an Event into the payload leaks
      // `event.target` (a DOM element) and explodes BSON nested-depth.
      const safeOverrides: Partial<SabFlowDoc> | undefined =
        overrides && typeof overrides === 'object'
          && !(typeof Event !== 'undefined' && overrides instanceof Event)
          && !(typeof Node !== 'undefined' && overrides instanceof Node)
          ? overrides
          : undefined;
      startSaving(async () => {
        const rawPayload = {
          name: flow.name,
          events: flow.events,
          groups: flow.groups,
          edges: flow.edges,
          variables: flow.variables,
          theme: flow.theme,
          settings: flow.settings,
          status: flow.status,
          ...safeOverrides,
        };
        // Strip every non-JSON value (functions, React elements, Symbols, class
        // instances without toJSON, etc.) before the payload crosses the server
        // action boundary. Without this, an unserializable value gets wrapped
        // in a "temporary client reference" Proxy on the server — and when
        // Mongo's BSON encoder probes `.toBSON()` on it, the Proxy throws
        // "Cannot access toBSON on the server. You cannot dot into a
        // temporary client reference from a server component."
        const payload = toJsonSafe(rawPayload) as typeof rawPayload;
        const result = await saveSabFlow(flow._id, payload);
        if (result && 'error' in result) {
          setSaveError(result.error as string);
        } else {
          setLastSaved(new Date());
        }
      });
    },
    [flow],
  );

  /* ── Keyboard shortcuts ──────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+S — save
      if (meta && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        save();
        return;
      }

      // Cmd+Shift+Z — redo (must come before plain Cmd+Z)
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd+Z — undo
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save, undo, redo]);

  /* ── Publish toggle ───────────────────────────────────────────────────── */

  const handlePublishToggle = useCallback(() => {
    const isPublished = flow.status === 'PUBLISHED';
    const newStatus = isPublished ? 'DRAFT' : 'PUBLISHED';
    setFlow((prev) => ({ ...prev, status: newStatus }));
    if (isPublished) setWebhookBanner(null);
    startSaving(async () => {
      setSaveError(null);
      const result = isPublished
        ? await deactivateSabFlow(flow._id)
        : await activateSabFlow(flow._id);
      if (result && 'error' in result) {
        setSaveError(result.error as string);
        setFlow((prev) => ({ ...prev, status: isPublished ? 'PUBLISHED' : 'DRAFT' }));
      } else {
        setLastSaved(new Date());
        if (!isPublished) {
          const webhooks = (result as { webhooks?: Array<{ appEvent: string; webhookId: string; webhookUrl: string }> }).webhooks;
          if (webhooks?.length) setWebhookBanner(webhooks);
        }
      }
    });
  }, [flow.status, flow._id, startSaving]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col overflow-clip bg-[var(--gray-2)]"
    >
      {/* ── Webhook URL banner (shown after activation) ────────────── */}
      {webhookBanner && webhookBanner.length > 0 && (
        <div className="relative bg-[#1a1a2e] border-b border-[#8b5cf6]/30 px-4 py-2.5 flex items-start gap-3 text-[12px]">
          <LuLink className="h-3.5 w-3.5 text-[#8b5cf6] shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="flex-1 space-y-1.5">
            <p className="text-[var(--gray-11)] font-medium">Webhook URL{webhookBanner.length > 1 ? 's' : ''} registered</p>
            {webhookBanner.map((w) => (
              <div key={w.webhookId ?? w.webhookUrl} className="flex items-center gap-2">
                <span className="font-mono text-[#a78bfa] break-all">{w.webhookUrl}</span>
                <button
                  type="button"
                  title="Copy URL"
                  onClick={() => navigator.clipboard?.writeText(w.webhookUrl)}
                  className="shrink-0 text-[var(--gray-8)] hover:text-[var(--gray-11)] transition-colors"
                >
                  <LuCopy className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWebhookBanner(null)}
            className="shrink-0 text-[var(--gray-7)] hover:text-[var(--gray-11)] transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <FlowEditorHeader
        flow={flow}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        saveError={saveError}
        lastSaved={lastSaved}
        onUndo={undo}
        onRedo={redo}
        onSave={save}
        onPublishToggle={handlePublishToggle}
        onNameChange={handleNameChange}
        validationErrorCount={countValidationResults(validationResults).errorCount}
        validationWarningCount={countValidationResults(validationResults).warningCount}
        isValidationPanelOpen={activePanel === 'validation'}
        onValidationToggle={() => togglePanel('validation')}
      >
        {/* Panel toggle buttons rendered after the divider in the header */}

        {/* Presence avatar stack — active collaborators (Phase C.8.2).
            Gated behind NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED; renders nothing
            when the flag is off or no peers are connected. Sits before the
            panel toggles so it doesn't get pushed off-screen on narrow
            viewports as the right-side toolbar grows. The `mr-1` keeps a
            tiny gap from the variables button so the avatars don't visually
            collide with the icon row. */}
        <div className="mr-1 flex items-center">
          <CollabAvatarStack />
        </div>

        {/* Variables panel toggle */}
        <button
          type="button"
          onClick={() => togglePanel('variables')}
          title="Variables"
          aria-label="Toggle variables panel"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'variables'
              ? 'bg-orange-50 text-[#f76808] dark:bg-orange-950/40'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuVariable className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Theme panel toggle */}
        <button
          type="button"
          onClick={() => togglePanel('theme')}
          title="Theme"
          aria-label="Toggle theme panel"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'theme'
              ? 'bg-orange-50 text-[#f76808] dark:bg-orange-950/40 dark:text-orange-400'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuPalette className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Preview panel toggle */}
        <button
          type="button"
          onClick={() => togglePanel('preview')}
          title="Preview"
          aria-label="Toggle preview panel"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'preview'
              ? 'bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuPlay className="h-4 w-4 translate-x-px" strokeWidth={1.8} />
        </button>

        {/* Settings panel toggle */}
        <button
          type="button"
          onClick={() => togglePanel('settings')}
          title="Flow settings"
          aria-label="Toggle settings panel"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'settings'
              ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuSettings className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Version history panel toggle */}
        <button
          type="button"
          onClick={() => togglePanel('versions')}
          title="Version history"
          aria-label="Toggle version history panel"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'versions'
              ? 'bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuHistory className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </FlowEditorHeader>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-clip">

        {/* Left sidebar: block palette */}
        <BlocksSideBar />

        {/* Centre: n8n-style WorkflowCanvas. Replaces the Typebot-style Graph
           while preserving the BlocksSideBar drag-in flow and the right-rail
           BlockSettingsPanel wiring via `openedNodeId`.

           Wrapped in a relatively-positioned div so the remote-cursor overlay
           (Phase C.8.2) can absolutely-position over the canvas surface
           without bleeding onto the sidebars. The wrapper is `flex-1` so the
           canvas keeps its existing fill behaviour. `min-w-0` prevents the
           canvas's intrinsic min-content from blowing the flex row out when
           a side panel opens. */}
        <div className="relative flex flex-1 min-w-0 overflow-hidden">
          <WorkflowCanvas
            flow={flow}
            onFlowChange={handleDocChange}
            containerRef={containerRef}
          />

          {/* Remote cursors overlay — sibling of the canvas so cursors render
             on top of the workflow surface but underneath any side panels.
             Gated behind NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED. Renders null
             when collab is disabled or no remote peers are connected. */}
          <CollabRemoteCursors />
        </div>

        {/* Right rail: one panel at a time */}

        {/* Block settings panel — slides in from the right when a block node is clicked */}
        <BlockSettingsPanel
          flow={flow}
          onFlowChange={handleFlowChange}
          onVariablesChange={(variables) => setFlow((prev) => ({ ...prev, variables }))}
        />

        {/* Variables panel */}
        {activePanel === 'variables' && (
          <div className="w-[300px] shrink-0 border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden flex flex-col">
            <VariablesPanel
              variables={flow.variables}
              onVariablesChange={(variables) => setFlow((prev) => ({ ...prev, variables }))}
              flow={flow}
            />
          </div>
        )}

        {/* Theme panel */}
        {activePanel === 'theme' && (
          <ThemePanel
            theme={flow.theme}
            onThemeChange={(theme) => setFlow((prev) => ({ ...prev, theme }))}
            onClose={() => setActivePanel(null)}
          />
        )}

        {/* Flow settings */}
        {activePanel === 'settings' && (
          <FlowSettingsPanel
            flow={flow}
            onUpdate={(changes) => setFlow((prev) => ({ ...prev, ...changes }))}
            onClose={() => setActivePanel(null)}
          />
        )}

        {/* Preview */}
        {activePanel === 'preview' && (
          <FlowPreviewPanel
            flow={flow}
            onClose={() => setActivePanel(null)}
          />
        )}

        {/* Validation panel */}
        {activePanel === 'validation' && (
          <ValidationPanel
            flow={flow}
            onFocusBlock={handleFocusBlock}
            onResultsChange={setValidationResults}
            onClose={() => setActivePanel(null)}
          />
        )}

        {/* Version history panel */}
        {activePanel === 'versions' && (
          <VersionHistoryPanel
            flowId={flow._id}
            onClose={() => setActivePanel(null)}
            onRestore={(restoredFlow) => {
              setFlow(restoredFlow);
              setHistory([restoredFlow]);
              setHistoryIndex(0);
            }}
          />
        )}
      </div>

      {/* Drag overlay rendered at root level so it escapes stacking contexts */}
      <BlockCardOverlay />
    </div>
  );
}

/* ── EditorPage: provider shell ──────────────────────────────────────────── */

export function EditorPage({ flow }: Props) {
  return (
    <GraphProvider>
      <GraphDndProvider>
        {/* CollabProvider runs the presence beacon once and fans the result
           out to the header avatar stack and the canvas cursor overlay via
           React context. When NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED is unset
           (default) the provider passes an empty flowId to `usePresence`,
           short-circuiting its polling effect so no network beacons fire. */}
        <CollabProvider flowId={flow._id}>
          <EditorContent flow={flow} />
        </CollabProvider>
      </GraphDndProvider>
    </GraphProvider>
  );
}
