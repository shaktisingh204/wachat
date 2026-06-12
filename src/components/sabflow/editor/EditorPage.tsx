'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { GraphProvider, useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { GraphDndProvider } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { ReactFlowProvider } from '@xyflow/react';
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
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { ValidationPanel } from '@/components/sabflow/panels/ValidationPanel';
import {
  CollabProvider,
  CollabAvatarStack,
  CollabRemoteCursors,
} from './chrome/EditorCollabMount';
import { saveSabFlow, activateSabFlow, deactivateSabFlow } from '@/app/actions/sabflow';
import { toJsonSafe } from '@/lib/sabflow/toJsonSafe';
import { SABFLOW_COLLAB_ENABLED } from '@/lib/sabflow/features';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { countValidationResults } from '@/lib/sabflow/validation';
import type { ValidationError } from '@/lib/sabflow/validation';
import { IconButton } from '@/components/sabcrm/20ui';
import { Settings, Play, Variable, Palette, History, Link, Copy, X } from 'lucide-react';

/* ── Constants ───────────────────────────────────────────────────────────── */

const MAX_HISTORY = 50;

/** Autosave fires this long after the last flow mutation. */
const AUTOSAVE_DELAY_MS = 3000;

// SABFLOW_COLLAB_ENABLED is imported from '@/lib/sabflow/features'.
// It is a build-time constant (NEXT_PUBLIC_*) so the disabled branch
// tree-shakes cleanly when the flag is unset.

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

  /* ── Dirty tracking ──────────────────────────────────────────────────── */

  // A monotonically increasing edit counter. Every flow mutation bumps it;
  // a successful save captures the value it persisted. `isDirty` is then a
  // trivial integer comparison - no deep-comparing of large flow docs.
  const [editCount, setEditCount] = useState(0);
  const [savedEditCount, setSavedEditCount] = useState(0);
  const isDirty = editCount !== savedEditCount;

  // Ref mirror of editCount for handlers that need the latest value without
  // depending on it (e.g. marking the doc clean after a version restore).
  const editCountRef = useRef(0);

  const markEdit = useCallback(() => {
    editCountRef.current += 1;
    setEditCount(editCountRef.current);
  }, []);

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
      markEdit();
    },
    [historyIndex, markEdit],
  );

  const undo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setFlow(history[newIndex]);
    markEdit();
  }, [canUndo, historyIndex, history, markEdit]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setFlow(history[newIndex]);
    markEdit();
  }, [canRedo, historyIndex, history, markEdit]);

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
   * Full-document replace - used by the n8n-style WorkflowCanvas, which
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
      // SyntheticEvent - spreading an Event into the payload leaks
      // `event.target` (a DOM element) and explodes BSON nested-depth.
      const safeOverrides: Partial<SabFlowDoc> | undefined =
        overrides && typeof overrides === 'object'
          && !(typeof Event !== 'undefined' && overrides instanceof Event)
          && !(typeof Node !== 'undefined' && overrides instanceof Node)
          ? overrides
          : undefined;
      // Capture the edit counter the moment the save starts: edits made while
      // the request is in flight keep the editor dirty after it resolves.
      const editCountAtSave = editCount;
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
        // in a "temporary client reference" Proxy on the server - and when
        // Mongo's BSON encoder probes `.toBSON()` on it, the Proxy throws
        // "Cannot access toBSON on the server. You cannot dot into a
        // temporary client reference from a server component."
        const payload = toJsonSafe(rawPayload) as typeof rawPayload;
        const result = await saveSabFlow(flow._id, payload);
        if (result && 'error' in result) {
          setSaveError(result.error as string);
        } else {
          setLastSaved(new Date());
          setSavedEditCount(editCountAtSave);
        }
      });
    },
    [flow, editCount],
  );

  /* ── Autosave ────────────────────────────────────────────────────────── */

  // Debounced autosave: fires AUTOSAVE_DELAY_MS after the last flow mutation.
  // - Every edit changes `save`'s identity (it closes over `flow`), so the
  //   pending timer resets on each mutation - including continuous drag
  //   commits from the canvas, which keep deferring the save until idle.
  // - While a save is in flight (`isSaving`) no timer is scheduled; when it
  //   settles, the effect re-runs and reschedules if edits arrived meanwhile.
  // - After a failed save (`saveError` set) autosave pauses so it doesn't
  //   hammer a broken endpoint - the user retries explicitly via Save/Cmd+S.
  useEffect(() => {
    if (!isDirty || isSaving || saveError) return;
    const timer = setTimeout(() => save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isDirty, isSaving, saveError, save]);

  /* ── Warn before leaving with unsaved changes ────────────────────────── */

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set for the prompt to show.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ── Keyboard shortcuts ──────────────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+S - save
      if (meta && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        save();
        return;
      }

      // Cmd+Shift+Z - redo (must come before plain Cmd+Z)
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd+Z - undo
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
      className="20ui absolute inset-0 flex flex-col overflow-clip bg-[var(--st-bg-secondary)]"
    >
      {/* ── Webhook URL banner (shown after activation) ────────────── */}
      {webhookBanner && webhookBanner.length > 0 && (
        <div className="relative bg-[var(--st-accent-soft)] border-b border-[var(--st-border)] px-4 py-2.5 flex items-start gap-3 text-[12px]">
          <Link className="h-3.5 w-3.5 text-[var(--st-accent)] shrink-0 mt-0.5" strokeWidth={1.8} aria-hidden="true" />
          <div className="flex-1 space-y-1.5">
            <p className="text-[var(--st-text)] font-medium">Webhook URL{webhookBanner.length > 1 ? 's' : ''} registered</p>
            {webhookBanner.map((w) => (
              <div key={w.webhookId ?? w.webhookUrl} className="flex items-center gap-2">
                <span className="font-mono text-[var(--st-text-secondary)] break-all">{w.webhookUrl}</span>
                <IconButton
                  label="Copy URL"
                  icon={Copy}
                  size="sm"
                  onClick={() => navigator.clipboard?.writeText(w.webhookUrl)}
                />
              </div>
            ))}
          </div>
          <IconButton
            label="Dismiss banner"
            icon={X}
            size="sm"
            className="shrink-0"
            onClick={() => setWebhookBanner(null)}
          />
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <FlowEditorHeader
        flow={flow}
        canUndo={canUndo}
        canRedo={canRedo}
        isSaving={isSaving}
        isDirty={isDirty}
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

        {/* Presence avatar stack - active collaborators (Phase C.8.2).
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
        <IconButton
          label="Toggle variables panel"
          icon={Variable}
          variant={activePanel === 'variables' ? 'secondary' : 'ghost'}
          aria-pressed={activePanel === 'variables'}
          onClick={() => togglePanel('variables')}
        />

        {/* Theme panel toggle */}
        <IconButton
          label="Toggle theme panel"
          icon={Palette}
          variant={activePanel === 'theme' ? 'secondary' : 'ghost'}
          aria-pressed={activePanel === 'theme'}
          onClick={() => togglePanel('theme')}
        />

        {/* Preview panel toggle */}
        <IconButton
          label="Toggle preview panel"
          icon={Play}
          variant={activePanel === 'preview' ? 'secondary' : 'ghost'}
          aria-pressed={activePanel === 'preview'}
          onClick={() => togglePanel('preview')}
        />

        {/* Settings panel toggle */}
        <IconButton
          label="Toggle settings panel"
          icon={Settings}
          variant={activePanel === 'settings' ? 'secondary' : 'ghost'}
          aria-pressed={activePanel === 'settings'}
          onClick={() => togglePanel('settings')}
        />

        {/* Version history panel toggle */}
        <IconButton
          label="Toggle version history panel"
          icon={History}
          variant={activePanel === 'versions' ? 'secondary' : 'ghost'}
          aria-pressed={activePanel === 'versions'}
          onClick={() => togglePanel('versions')}
        />
      </FlowEditorHeader>

      {/* ── Main area ─────────────────────────────────────────────────────
         One ReactFlowProvider spans the canvas AND the right-rail panels:
         panel hooks (useContextVariables → useReactFlow) must read the same
         store the canvas writes; mounting them outside the provider throws
         React Flow error #001. WorkflowCanvas no longer creates its own. */}
      <ReactFlowProvider>
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
          <EditorErrorBoundary label="canvas" fallbackClassName="flex-1">
            <WorkflowCanvas
              flow={flow}
              onFlowChange={handleDocChange}
              containerRef={containerRef}
            />

            {/* Remote cursors overlay - sibling of the canvas so cursors render
               on top of the workflow surface but underneath any side panels.
               Gated behind NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED. Renders null
               when collab is disabled or no remote peers are connected. */}
            <CollabRemoteCursors />
          </EditorErrorBoundary>
        </div>

        {/* Right rail: one panel at a time. Wrapped in its own error boundary
           so a crash inside a settings/side panel never takes the canvas
           down with it. */}
        <EditorErrorBoundary
          label="side panel"
          fallbackClassName="z-20 w-[320px] shrink-0 border-l border-[var(--st-border)]"
        >

        {/* Block settings panel - slides in from the right when a block node is clicked */}
        <BlockSettingsPanel
          flow={flow}
          onFlowChange={handleFlowChange}
          onVariablesChange={(variables) => {
            setFlow((prev) => ({ ...prev, variables }));
            markEdit();
          }}
        />

        {/* Variables panel */}
        {activePanel === 'variables' && (
          <div className="w-[300px] shrink-0 border-l border-[var(--st-border)] bg-[var(--st-bg)] z-20 overflow-hidden flex flex-col">
            <VariablesPanel
              variables={flow.variables}
              onVariablesChange={(variables) => {
                setFlow((prev) => ({ ...prev, variables }));
                markEdit();
              }}
              flow={flow}
            />
          </div>
        )}

        {/* Theme panel */}
        {activePanel === 'theme' && (
          <ThemePanel
            theme={flow.theme}
            onThemeChange={(theme) => {
              setFlow((prev) => ({ ...prev, theme }));
              markEdit();
            }}
            onClose={() => setActivePanel(null)}
          />
        )}

        {/* Flow settings */}
        {activePanel === 'settings' && (
          <FlowSettingsPanel
            flow={flow}
            onUpdate={(changes) => {
              setFlow((prev) => ({ ...prev, ...changes }));
              markEdit();
            }}
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
              // The restore endpoint already persisted this snapshot as the
              // current doc, so the editor is clean (any unsaved edits were
              // replaced by the restore).
              setSavedEditCount(editCountRef.current);
              setLastSaved(new Date());
            }}
          />
        )}
        </EditorErrorBoundary>
      </div>
      </ReactFlowProvider>

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
        {SABFLOW_COLLAB_ENABLED ? (
          /* CollabProvider runs the presence beacon and fans the result out to
             the header avatar stack and the canvas cursor overlay via React
             context. Only mounted when NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED is
             'true'/'1'. When the flag is off the collab bundle (Yjs, y-protocols,
             WebSocket provider) is excluded via tree-shaking and the editor falls
             back to the standalone REST-save path below. */
          <CollabProvider flowId={flow._id}>
            <EditorContentCollab flow={flow} />
          </CollabProvider>
        ) : (
          /* Non-collab path: plain in-memory useState editor, zero Yjs dep. */
          <EditorContent flow={flow} />
        )}
      </GraphDndProvider>
    </GraphProvider>
  );
}
