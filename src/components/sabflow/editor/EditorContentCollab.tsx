'use client';

/**
 * EditorContentCollab — CRDT-backed twin of `EditorContent` from
 * `./EditorPage.tsx`. Phase C.8 sub-task #1.
 *
 * This file is lazy-loaded (see `EditorPage.tsx`'s `next/dynamic` call) so
 * its Yjs dependency chain is excluded from the bundle when the
 * `NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED` flag is off.
 *
 * Architectural contract
 * ----------------------
 * 1. `useSabFlowDoc({ workspaceId, docId, fetchToken })` owns the WebSocket
 *    + Y.Doc lifecycle (Phase 5 sub-task #1).
 * 2. The full `SabFlowDoc` payload is mirrored on a single `Y.Map` named
 *    `meta` for this sub-task. Per ADR
 *    `docs/adr/sabflow-state-management.md` §4 step 6, downstream sub-tasks
 *    (#2..#5) promote `groups` / `edges` / `variables` / `theme` /
 *    `settings` to their own Y.Array / Y.Map structures for proper merge
 *    granularity. Until then this file keeps the shape consistent with the
 *    legacy `useState` branch — the swap is invisible to the rest of the
 *    editor.
 * 3. Every local mutation runs inside `doc.transact(..., SABFLOW_LOCAL_ORIGIN)`
 *    so {@link SabFlowUndoManager} captures it on the local-undo path.
 *    Remote applies (tagged `'from server'` upstream by `useSabFlowDoc`'s
 *    `PROVIDER_ORIGIN`) are NOT in `trackedOrigins` and therefore NOT
 *    undoable — that's the property we want for collab.
 * 4. Undo/redo replaces the legacy `history`/`historyIndex` snapshot stack
 *    with `SabFlowUndoManager` (`Y.UndoManager` wrapper per Phase 5 #6).
 * 5. The component's `Props` shape is identical to `EditorContent`'s so
 *    `EditorPage` can swap branches without prop drilling.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import * as Y from 'yjs';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
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
import { saveSabFlow, activateSabFlow, deactivateSabFlow } from '@/app/actions/sabflow';
import { toJsonSafe } from '@/lib/sabflow/toJsonSafe';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { countValidationResults } from '@/lib/sabflow/validation';
import type { ValidationError } from '@/lib/sabflow/validation';
import { useSabFlowDoc } from '@/lib/sabflow/client/useSabFlowDoc';
import {
  SabFlowUndoManager,
  SABFLOW_LOCAL_ORIGIN,
  type YAbstractTypeLike,
  type YDocLike as UndoYDocLike,
  type YUndoManagerLike,
  type YUndoManagerOptions,
} from '@/lib/sabflow/client/undo-redo';
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

/* ── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  flow: SabFlowDoc & { _id: string };
};

type RightPanel =
  | 'settings'
  | 'preview'
  | 'variables'
  | 'theme'
  | 'validation'
  | 'versions'
  | null;

/**
 * Single Y.Map key used to mirror the SabFlowDoc payload in this first-cut
 * adapter. Phase 6 sub-tasks #2-5 will promote sub-fields to their own
 * top-level Y.Array / Y.Map structures (per ADR §4 step 6) — at which point
 * this constant goes away. Until then, one Y.Map with per-field entries is
 * enough to prove the hook-swap end to end.
 */
const META_MAP_KEY = 'meta';

/* ── Workspace + token plumbing ─────────────────────────────────────────── */

/**
 * Resolve the workspace id for the running session. The WebSocket gateway
 * requires it for room scoping (Phase 3 sub-task #2). We accept it from a
 * NEXT_PUBLIC_* env var so previews can override per-deploy; in production
 * the server action that delivers `initialFlow` will eventually mint a
 * matching JWT for the same workspace.
 */
const FALLBACK_WORKSPACE = process.env.NEXT_PUBLIC_SABFLOW_WORKSPACE_ID ?? 'default';

/**
 * Fetch a short-lived JWT for the WS handshake. The real endpoint
 * (Phase 8 sub-task #3 — share-link tokens, owner transfer) lands later; for
 * the C.8 hook-swap we POST to a placeholder route. If the route is missing
 * or returns non-2xx we surface the failure to `useSabFlowDoc` which will
 * back off + retry per its own contract.
 */
async function fetchSabFlowToken(docId: string): Promise<string> {
  const res = await fetch(`/api/sabflow/ws-token?docId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`sabflow-ws-token: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('sabflow-ws-token: empty token in response');
  return body.token;
}

/* ── Meta-map snapshot subscription ─────────────────────────────────────── */

/**
 * Read the doc's current SabFlowDoc projection out of the meta Y.Map. Falls
 * back to {@link initialFlow} fields when the meta map hasn't been seeded yet
 * — that gives the editor a meaningful first paint while the WS is still
 * connecting.
 */
function readFlowFromDoc(
  doc: Y.Doc | null,
  initialFlow: SabFlowDoc & { _id: string },
): SabFlowDoc & { _id: string } {
  if (!doc) return initialFlow;
  const meta = doc.getMap(META_MAP_KEY);
  // Each field is read with an `initialFlow` fallback so that BlockSettingsPanel
  // and the other consumers never see `undefined` for required fields.
  return {
    _id: initialFlow._id,
    name: (meta.get('name') as SabFlowDoc['name'] | undefined) ?? initialFlow.name,
    events: (meta.get('events') as SabFlowDoc['events'] | undefined) ?? initialFlow.events,
    groups: (meta.get('groups') as SabFlowDoc['groups'] | undefined) ?? initialFlow.groups,
    edges: (meta.get('edges') as SabFlowDoc['edges'] | undefined) ?? initialFlow.edges,
    variables:
      (meta.get('variables') as SabFlowDoc['variables'] | undefined) ?? initialFlow.variables,
    theme: (meta.get('theme') as SabFlowDoc['theme'] | undefined) ?? initialFlow.theme,
    settings:
      (meta.get('settings') as SabFlowDoc['settings'] | undefined) ?? initialFlow.settings,
    status: (meta.get('status') as SabFlowDoc['status'] | undefined) ?? initialFlow.status,
  } as SabFlowDoc & { _id: string };
}

/* ── EditorContentCollab ─────────────────────────────────────────────────── */

export function EditorContentCollab({ flow: initialFlow }: Props) {
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>(null);
  const [validationResults, setValidationResults] = useState<ValidationError[]>([]);
  const [webhookBanner, setWebhookBanner] = useState<
    Array<{ appEvent: string; webhookId: string; webhookUrl: string }> | null
  >(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setOpenedNodeId } = useGraph();

  /* ── Yjs doc lifecycle (replaces `useState(initialFlow)`) ───────────── */

  const fetchToken = useCallback(() => fetchSabFlowToken(initialFlow._id), [initialFlow._id]);

  const { doc, status: docStatus } = useSabFlowDoc({
    workspaceId: FALLBACK_WORKSPACE,
    docId: initialFlow._id,
    fetchToken,
  });

  // Seed the meta Y.Map from `initialFlow` once the doc is connected, but ONLY
  // when the doc is empty (i.e. brand-new room) — otherwise we'd clobber peer
  // writes. The check + seed runs inside a single transaction so it counts as
  // a local-undoable op (matches the n8n "I opened my workflow" expectation).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!doc) return;
    if (seededRef.current) return;
    if (docStatus !== 'connected') return;
    const meta = doc.getMap(META_MAP_KEY);
    if (meta.size > 0) {
      // Doc already populated by a peer — nothing to seed.
      seededRef.current = true;
      return;
    }
    doc.transact(() => {
      meta.set('name', initialFlow.name);
      meta.set('events', initialFlow.events);
      meta.set('groups', initialFlow.groups);
      meta.set('edges', initialFlow.edges);
      meta.set('variables', initialFlow.variables);
      meta.set('theme', initialFlow.theme);
      meta.set('settings', initialFlow.settings);
      meta.set('status', initialFlow.status);
    }, SABFLOW_LOCAL_ORIGIN);
    seededRef.current = true;
  }, [doc, docStatus, initialFlow]);

  // Subscribe to the meta Y.Map and materialize a stable `flow` snapshot for
  // React. `useSyncExternalStore` is the React-19-safe primitive for external
  // mutable sources — using `useState + useEffect` here would tear during
  // concurrent renders.
  //
  // Snapshot identity: `getSnapshot` MUST return a stable reference between
  // calls when nothing changed, otherwise React enters an infinite render
  // loop (see https://react.dev/reference/react/useSyncExternalStore#caveats).
  // We cache the materialised flow in a ref and only recompute it inside the
  // `subscribe` notify path — exactly the pattern used by `useCrdtNodes`.
  const flowCacheRef = useRef<(SabFlowDoc & { _id: string }) | null>(null);

  const subscribeFlow = useCallback(
    (notify: () => void) => {
      // Recompute the cache once on subscribe so the first getSnapshot read
      // is consistent with the just-attached observer.
      flowCacheRef.current = readFlowFromDoc(doc, initialFlow);
      if (!doc) return () => {};
      const meta = doc.getMap(META_MAP_KEY);
      const handler = () => {
        flowCacheRef.current = readFlowFromDoc(doc, initialFlow);
        notify();
      };
      meta.observeDeep(handler);
      return () => meta.unobserveDeep(handler);
    },
    [doc, initialFlow],
  );

  const getFlowSnapshot = useCallback((): SabFlowDoc & { _id: string } => {
    if (flowCacheRef.current === null) {
      flowCacheRef.current = readFlowFromDoc(doc, initialFlow);
    }
    return flowCacheRef.current;
  }, [doc, initialFlow]);

  // Server snapshot — matches the SSR-safe fallback path inside
  // `useSabFlowDoc`. Until first connect, render `initialFlow`.
  const getServerFlowSnapshot = useCallback(() => initialFlow, [initialFlow]);

  const flow = useSyncExternalStore(subscribeFlow, getFlowSnapshot, getServerFlowSnapshot);

  /* ── CRDT undo/redo (replaces `history` / `historyIndex` snapshot stack) ─ */

  const undoManager = useMemo<SabFlowUndoManager | null>(() => {
    if (!doc) return null;
    // Bridge the structural `YDocLike` contract from `undo-redo.ts` to the
    // concrete `Y.Doc`. The shapes line up — both `getArray` and `getMap` exist
    // on Y.Doc with compatible signatures.
    const docBridge: UndoYDocLike = {
      getArray: (name: string) => doc.getArray(name) as unknown as YAbstractTypeLike,
      getMap: (name: string) => doc.getMap(name) as unknown as YAbstractTypeLike,
    };
    return new SabFlowUndoManager(docBridge, {
      factory: (typeScope, options: YUndoManagerOptions): YUndoManagerLike => {
        // Cast `typeScope` back to the concrete Y abstract-type list and
        // construct the real `Y.UndoManager`. Yjs accepts a single abstract
        // type or an array; we pass the array unchanged.
        const um = new Y.UndoManager(
          typeScope as unknown as Y.AbstractType<unknown>[],
          {
            trackedOrigins: options.trackedOrigins,
            captureTimeout: options.captureTimeout,
          },
        );
        // `Y.UndoManager` matches our `YUndoManagerLike` surface — the only
        // gap is the stack types, which we narrow via `unknown`.
        return um as unknown as YUndoManagerLike;
      },
    });
  }, [doc]);

  useEffect(() => () => undoManager?.destroy(), [undoManager]);

  // Re-render when the undo/redo stack changes so canUndo/canRedo flow through
  // to the header.
  const [, forceUndoTick] = useState(0);
  useEffect(() => {
    if (!undoManager) return;
    return undoManager.on('stack-changed', () => forceUndoTick((n) => n + 1));
  }, [undoManager]);

  const canUndo = undoManager?.canUndo() ?? false;
  const canRedo = undoManager?.canRedo() ?? false;

  const undo = useCallback(() => undoManager?.undo(), [undoManager]);
  const redo = useCallback(() => undoManager?.redo(), [undoManager]);

  /* ── Mutation helpers (every `setFlow` callsite maps to one of these) ── */

  /**
   * Apply a partial patch to the meta map inside a single local-origin
   * transaction. Mirrors `setFlow(prev => ({ ...prev, ...patch }))` from the
   * legacy branch — the Y.Doc absorbs concurrent peer updates between the
   * read and write because the transaction is the atomic unit, not the
   * JavaScript object spread.
   */
  const patchMeta = useCallback(
    (patch: any) => {
      if (!doc) return;
      doc.transact(() => {
        const meta = doc.getMap(META_MAP_KEY);
        for (const [key, value] of Object.entries(patch)) {
          // Never mirror the mongo `_id` into the CRDT — it's an external
          // identifier owned by the route, not by the editor doc.
          if (key === '_id') continue;
          if (value === undefined) {
            meta.delete(key);
          } else {
            meta.set(key, value);
          }
        }
      }, SABFLOW_LOCAL_ORIGIN);
    },
    [doc],
  );

  /* ── Panel toggle (unchanged from legacy branch) ─────────────────────── */

  const togglePanel = useCallback(
    (panel: Exclude<RightPanel, null>) => {
      setActivePanel((prev) => {
        if (prev === panel) return null;
        setOpenedNodeId(undefined);
        return panel;
      });
    },
    [setOpenedNodeId],
  );

  /* ── Validation focus handler (unchanged) ────────────────────────────── */

  const handleFocusBlock = useCallback(
    (_groupId: string, blockId?: string) => {
      if (blockId) setOpenedNodeId(blockId);
      setActivePanel(null);
    },
    [setOpenedNodeId],
  );

  /* ── Flow change handler (legacy `handleFlowChange`) ──────────────────── */

  const handleFlowChange = useCallback(
    (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => {
      patchMeta(changes);
    },
    [patchMeta],
  );

  /**
   * Full-document replace from `WorkflowCanvas`. Mirrors `handleDocChange`
   * but writes through the meta map. `_id` (when present from upstream
   * spread) is a route-level mongo id that lives outside the CRDT — we
   * `patchMeta` with the whole payload anyway because the meta map only
   * mirrors the SabFlowDoc fields and silently ignores extras at read time.
   */
  const handleDocChange = useCallback(
    (next: SabFlowDoc) => {
      patchMeta(next);
    },
    [patchMeta],
  );

  /* ── Name change (from header) ───────────────────────────────────────── */

  const handleNameChange = useCallback(
    (name: string) => {
      patchMeta({ name });
    },
    [patchMeta],
  );

  /* ── Save (server-side snapshot — Cmd+S still works) ─────────────────── */

  const save = useCallback(
    (overrides?: Partial<SabFlowDoc>) => {
      setSaveError(null);
      const safeOverrides: Partial<SabFlowDoc> | undefined =
        overrides &&
        typeof overrides === 'object' &&
        !(typeof Event !== 'undefined' && overrides instanceof Event) &&
        !(typeof Node !== 'undefined' && overrides instanceof Node)
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

  /* ── Keyboard shortcuts (same surface, undo/redo now hits Y.UndoManager) ─ */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        save();
        return;
      }

      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save, undo, redo]);

  /* ── Publish toggle ──────────────────────────────────────────────────── */

  const handlePublishToggle = useCallback(() => {
    const isPublished = flow.status === 'PUBLISHED';
    const newStatus = isPublished ? 'DRAFT' : 'PUBLISHED';
    patchMeta({ status: newStatus });
    if (isPublished) setWebhookBanner(null);
    startSaving(async () => {
      setSaveError(null);
      const result = isPublished
        ? await deactivateSabFlow(flow._id)
        : await activateSabFlow(flow._id);
      if (result && 'error' in result) {
        setSaveError(result.error as string);
        // Roll the optimistic flip back into the doc so peers see consistency.
        patchMeta({ status: isPublished ? 'PUBLISHED' : 'DRAFT' });
      } else {
        setLastSaved(new Date());
        if (!isPublished) {
          const webhooks = (result as {
            webhooks?: Array<{ appEvent: string; webhookId: string; webhookUrl: string }>;
          }).webhooks;
          if (webhooks?.length) setWebhookBanner(webhooks);
        }
      }
    });
  }, [flow.status, flow._id, patchMeta]);

  /* ── Render (identical tree to the legacy `EditorContent`) ───────────── */

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col overflow-clip bg-[var(--gray-2)]"
    >
      {webhookBanner && webhookBanner.length > 0 && (
        <div className="relative bg-[#1a1a2e] border-b border-[#8b5cf6]/30 px-4 py-2.5 flex items-start gap-3 text-[12px]">
          <LuLink className="h-3.5 w-3.5 text-[#8b5cf6] shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="flex-1 space-y-1.5">
            <p className="text-[var(--gray-11)] font-medium">
              Webhook URL{webhookBanner.length > 1 ? 's' : ''} registered
            </p>
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

      <div className="flex flex-1 min-h-0 relative overflow-clip">
        <BlocksSideBar />

        <WorkflowCanvas
          flow={flow}
          onFlowChange={handleDocChange}
          containerRef={containerRef}
        />

        <BlockSettingsPanel
          flow={flow}
          onFlowChange={handleFlowChange}
          onVariablesChange={(variables) => patchMeta({ variables })}
        />

        {activePanel === 'variables' && (
          <div className="w-[300px] shrink-0 border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden flex flex-col">
            <VariablesPanel
              variables={flow.variables}
              onVariablesChange={(variables) => patchMeta({ variables })}
              flow={flow}
            />
          </div>
        )}

        {activePanel === 'theme' && (
          <ThemePanel
            theme={flow.theme}
            onThemeChange={(theme) => patchMeta({ theme })}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'settings' && (
          <FlowSettingsPanel
            flow={flow}
            onUpdate={(changes) => patchMeta(changes)}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'preview' && (
          <FlowPreviewPanel flow={flow} onClose={() => setActivePanel(null)} />
        )}

        {activePanel === 'validation' && (
          <ValidationPanel
            flow={flow}
            onFocusBlock={handleFocusBlock}
            onResultsChange={setValidationResults}
            onClose={() => setActivePanel(null)}
          />
        )}

        {activePanel === 'versions' && (
          <VersionHistoryPanel
            flowId={flow._id}
            onClose={() => setActivePanel(null)}
            onRestore={(restoredFlow) => {
              // Restore-from-version: blow away the current meta map and
              // replay the historical snapshot inside one transaction. The
              // UndoManager records it as a single local-undoable op so the
              // user can Cmd+Z to "I didn't mean to restore that".
              if (!doc) return;
              doc.transact(() => {
                const meta = doc.getMap(META_MAP_KEY);
                meta.clear();
                meta.set('name', restoredFlow.name);
                meta.set('events', restoredFlow.events);
                meta.set('groups', restoredFlow.groups);
                meta.set('edges', restoredFlow.edges);
                meta.set('variables', restoredFlow.variables);
                meta.set('theme', restoredFlow.theme);
                meta.set('settings', restoredFlow.settings);
                meta.set('status', restoredFlow.status);
              }, SABFLOW_LOCAL_ORIGIN);
            }}
          />
        )}
      </div>

      <BlockCardOverlay />
    </div>
  );
}

