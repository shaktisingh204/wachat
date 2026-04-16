'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { GraphProvider, useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import { GraphDndProvider } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { Graph } from '@/components/sabflow/graph/components/Graph';
import { BlocksSideBar } from './BlocksSideBar';
import { BlockCardOverlay } from './BlockCardOverlay';
import { BlockPropertiesPanel } from '@/components/sabflow/blocks/panels/BlockPropertiesPanel';
import { FlowSettingsPanel } from './FlowSettingsPanel';
import { FlowPreviewPanel } from './FlowPreviewPanel';
import { VariablesPanel } from '@/components/sabflow/variables/VariablesPanel';
import { saveSabFlow } from '@/app/actions/sabflow';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuArrowLeft,
  LuSave,
  LuCheck,
  LuLoader,
  LuCircleDot,
  LuCircleOff,
  LuSettings,
  LuPlay,
  LuVariable,
} from 'react-icons/lu';

/* ── Types ───────────────────────────────────────────────────────────────── */

type Props = {
  flow: SabFlowDoc & { _id: string };
};

type RightPanel = 'block' | 'settings' | 'preview' | 'variables' | null;

/* ── EditorContent (must be inside GraphProvider) ────────────────────────── */

function EditorContent({ flow: initialFlow }: Props) {
  const [flow, setFlow] = useState(initialFlow);
  const [isSaving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activePanel, setActivePanel] = useState<RightPanel>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { openedNodeId, setOpenedNodeId } = useGraph();

  // When a block is opened, switch the right rail to the block panel
  useEffect(() => {
    if (openedNodeId) setActivePanel('block');
  }, [openedNodeId]);

  // Toggle a toolbar panel; opening one closes others
  const togglePanel = useCallback((panel: Exclude<RightPanel, 'block' | null>) => {
    setActivePanel((prev) => {
      if (prev === panel) return null;
      // Close any open block
      setOpenedNodeId(undefined);
      return panel;
    });
  }, [setOpenedNodeId]);

  /* ── Flow change handler (passed down to Graph) ──────────────────────── */

  const handleFlowChange = useCallback(
    (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => {
      setFlow((prev) => ({ ...prev, ...changes }));
    },
    [],
  );

  /* ── Save ────────────────────────────────────────────────────────────── */

  const save = useCallback(
    (overrides?: Partial<SabFlowDoc>) => {
      setSaveError(null);
      startSaving(async () => {
        const payload = {
          name: flow.name,
          groups: flow.groups,
          edges: flow.edges,
          variables: flow.variables,
          theme: flow.theme,
          settings: flow.settings,
          status: flow.status,
          ...overrides,
        };
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

  /* ── Keyboard shortcut: Cmd/Ctrl + S ─────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  /* ── Publish toggle ───────────────────────────────────────────────────── */

  const handlePublishToggle = () => {
    const newStatus = flow.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setFlow((prev) => ({ ...prev, status: newStatus }));
    save({ status: newStatus });
  };

  /* ── Block currently open in properties panel ────────────────────────── */

  const openedBlock =
    activePanel === 'block' && openedNodeId
      ? flow.groups.flatMap((g) => g.blocks).find((b) => b.id === openedNodeId)
      : null;

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-screen overflow-clip bg-[var(--gray-2)]"
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--gray-5)] bg-[var(--gray-1)] px-4 z-30">

        {/* Back */}
        <Link
          href="/dashboard/sabflow/flow-builder"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          title="Back to flows"
        >
          <LuArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>

        <div className="h-5 w-px bg-[var(--gray-5)]" />

        {/* Editable flow name */}
        <input
          type="text"
          value={flow.name}
          onChange={(e) => setFlow((prev) => ({ ...prev, name: e.target.value }))}
          onBlur={() => save()}
          className="text-[14px] font-semibold text-[var(--gray-12)] bg-transparent border-none outline-none focus:ring-0 min-w-0 w-[200px] truncate hover:bg-[var(--gray-3)] focus:bg-[var(--gray-3)] rounded px-1 -ml-1 transition-colors"
          aria-label="Flow name"
        />

        <div className="flex-1" />

        {/* Save status */}
        {saveError ? (
          <span className="text-[11.5px] text-red-500 flex items-center gap-1.5 max-w-[180px] truncate">
            {saveError}
          </span>
        ) : lastSaved ? (
          <span className="text-[11.5px] text-[var(--gray-9)] flex items-center gap-1.5">
            <LuCheck className="h-3.5 w-3.5 text-green-500 shrink-0" strokeWidth={2.5} />
            Saved
          </span>
        ) : null}

        {/* Save button */}
        <button
          onClick={() => save()}
          disabled={isSaving}
          title="Save (Cmd+S)"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            isSaving
              ? 'bg-[var(--gray-4)] text-[var(--gray-9)] cursor-wait'
              : 'bg-amber-500 text-white hover:bg-amber-600',
          )}
        >
          {isSaving ? (
            <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <LuSave className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        {/* Publish toggle */}
        <button
          onClick={handlePublishToggle}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            flow.status === 'PUBLISHED'
              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/60'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          {flow.status === 'PUBLISHED' ? (
            <>
              <LuCircleDot className="h-3.5 w-3.5" strokeWidth={2} />
              Published
            </>
          ) : (
            <>
              <LuCircleOff className="h-3.5 w-3.5" strokeWidth={2} />
              Publish
            </>
          )}
        </button>

        <div className="h-5 w-px bg-[var(--gray-5)]" />

        {/* Variables panel toggle */}
        <button
          onClick={() => togglePanel('variables')}
          title="Variables"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'variables'
              ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuVariable className="h-4 w-4" strokeWidth={1.8} />
        </button>

        {/* Preview panel toggle */}
        <button
          onClick={() => togglePanel('preview')}
          title="Preview"
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
          onClick={() => togglePanel('settings')}
          title="Flow settings"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            activePanel === 'settings'
              ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
              : 'text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
          )}
        >
          <LuSettings className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </header>

      {/* ── Main area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-clip">

        {/* Left sidebar: block palette */}
        <BlocksSideBar />

        {/* Centre: graph canvas */}
        <Graph
          flow={flow}
          onFlowChange={handleFlowChange}
          containerRef={containerRef}
        />

        {/* Right rail: one panel at a time */}

        {/* Block properties */}
        {activePanel === 'block' && openedBlock && (
          <BlockPropertiesPanel
            block={openedBlock}
            variables={flow.variables}
            onUpdate={(changes) => {
              setFlow((prev) => ({
                ...prev,
                groups: prev.groups.map((g) => ({
                  ...g,
                  blocks: g.blocks.map((b) =>
                    b.id === openedBlock.id ? { ...b, ...changes } : b,
                  ),
                })),
              }));
            }}
          />
        )}

        {/* Variables panel */}
        {activePanel === 'variables' && (
          <div className="w-[300px] shrink-0 border-l border-[var(--gray-5)] bg-[var(--gray-1)] z-20 overflow-hidden flex flex-col">
            <VariablesPanel
              variables={flow.variables}
              onUpdate={(variables) => setFlow((prev) => ({ ...prev, variables }))}
            />
          </div>
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
        <EditorContent flow={flow} />
      </GraphDndProvider>
    </GraphProvider>
  );
}
