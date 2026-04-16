'use client';
import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GraphProvider } from '@/components/sabflow/graph/providers/GraphProvider';
import { GraphDndProvider } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { Graph } from '@/components/sabflow/graph/components/Graph';
import { BlocksSideBar } from './BlocksSideBar';
import { BlockCardOverlay } from './BlockCardOverlay';
import { BlockPropertiesPanel } from '@/components/sabflow/blocks/panels/BlockPropertiesPanel';
import { saveSabFlow } from '@/app/actions/sabflow';
import { useGraph } from '@/components/sabflow/graph/providers/GraphProvider';
import type { SabFlowDoc, Group } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuArrowLeft,
  LuSave,
  LuPlayCircle,
  LuSettings2,
  LuCheckCircle,
  LuLoader,
} from 'react-icons/lu';
import Link from 'next/link';

type Props = {
  flow: SabFlowDoc & { _id: string };
};

function EditorContent({ flow: initialFlow }: Props) {
  const router = useRouter();
  const [flow, setFlow] = useState(initialFlow);
  const [isSaving, startSaving] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { openedNodeId } = useGraph();

  const handleFlowChange = useCallback(
    (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => {
      setFlow((prev) => ({ ...prev, ...changes }));
    },
    [],
  );

  const handleGroupUpdate = useCallback((id: string, changes: Partial<Group>) => {
    setFlow((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === id ? { ...g, ...changes } : g)),
    }));
  }, []);

  const handleSave = () => {
    startSaving(async () => {
      await saveSabFlow(flow._id, {
        name: flow.name,
        groups: flow.groups,
        edges: flow.edges,
        variables: flow.variables,
        theme: flow.theme,
      });
      setLastSaved(new Date());
    });
  };

  const openedBlock = openedNodeId
    ? flow.groups.flatMap((g) => g.blocks).find((b) => b.id === openedNodeId)
    : null;

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden bg-[var(--gray-2)]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--gray-5)] bg-[var(--gray-1)] px-4 z-30">
        <Link
          href="/dashboard/sabflow/flow-builder"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>

        <div className="h-5 w-px bg-[var(--gray-5)]" />

        {/* Flow name */}
        <input
          type="text"
          value={flow.name}
          onChange={(e) => setFlow((prev) => ({ ...prev, name: e.target.value }))}
          className="text-[14px] font-semibold text-[var(--gray-12)] bg-transparent border-none outline-none focus:ring-0 w-[200px] truncate"
        />

        <div className="flex-1" />

        {/* Status indicator */}
        {lastSaved && (
          <span className="text-[11.5px] text-[var(--gray-9)] flex items-center gap-1.5">
            <LuCheckCircle className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />
            Saved
          </span>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            isSaving
              ? 'bg-[var(--gray-4)] text-[var(--gray-9)] cursor-wait'
              : 'bg-[#f76808] text-white hover:bg-[#e25c00]',
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
          onClick={() => {
            const newStatus = flow.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
            setFlow((prev) => ({ ...prev, status: newStatus }));
            startSaving(async () => {
              await saveSabFlow(flow._id, { status: newStatus });
            });
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            flow.status === 'PUBLISHED'
              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          <LuPlayCircle className="h-3.5 w-3.5" strokeWidth={2} />
          {flow.status === 'PUBLISHED' ? 'Published' : 'Publish'}
        </button>
      </header>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left sidebar (block palette) */}
        <BlocksSideBar />

        {/* Canvas */}
        <Graph
          flow={flow}
          onFlowChange={handleFlowChange}
          containerRef={containerRef}
        />

        {/* Right panel: block properties */}
        {openedBlock && (
          <BlockPropertiesPanel
            block={openedBlock}
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
      </div>

      {/* Block drag overlay */}
      <BlockCardOverlay />
    </div>
  );
}

export function EditorPage({ flow }: Props) {
  return (
    <GraphProvider>
      <GraphDndProvider>
        <EditorContent flow={flow} />
      </GraphDndProvider>
    </GraphProvider>
  );
}
