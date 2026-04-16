'use client';
import { useState, useTransition } from 'react';
import {
  LuArrowLeft,
  LuSave,
  LuCheck,
  LuLoader,
  LuZap,
  LuZapOff,
} from 'react-icons/lu';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { WorkflowProvider, useWorkflow } from './WorkflowContext';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { N8NNodesList } from './nodes/N8NNodesList';
import { N8NNodeRegistry } from './nodes/N8NNodeProperties';
import type { N8NCanvasWorkflow, N8NCanvasNode } from './types';

type Props = {
  workflow: N8NCanvasWorkflow;
  /** Called on Save. Should persist the workflow via a Server Action. */
  onSave?: (workflow: N8NCanvasWorkflow) => Promise<void>;
  /** Back-link href. Defaults to /dashboard/n8n. */
  backHref?: string;
};

function EditorContent({
  workflow: initialWorkflow,
  onSave,
  backHref = '/dashboard/n8n',
}: Props) {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [isSaving, startSaving] = useTransition();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { selectedNodeId } = useWorkflow();

  const handleChange = (
    changes: Partial<Pick<N8NCanvasWorkflow, 'nodes' | 'connections'>>,
  ) => {
    setWorkflow((prev) => ({ ...prev, ...changes }));
  };

  const handleSave = () => {
    startSaving(async () => {
      await onSave?.(workflow);
      setLastSaved(new Date());
    });
  };

  const handleToggleActive = () => {
    const updated = { ...workflow, active: !workflow.active };
    setWorkflow(updated);
    startSaving(async () => {
      await onSave?.(updated);
    });
  };

  const selectedNode = selectedNodeId
    ? workflow.nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  return (
    <div className="flex flex-col h-screen overflow-clip bg-[var(--gray-2)]">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--gray-5)] bg-[var(--gray-1)] px-4 z-30">
        <Link
          href={backHref}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>

        <div className="h-5 w-px bg-[var(--gray-5)]" />

        {/* Workflow name */}
        <input
          type="text"
          value={workflow.name}
          onChange={(e) =>
            setWorkflow((prev) => ({ ...prev, name: e.target.value }))
          }
          className="text-[14px] font-semibold text-[var(--gray-12)] bg-transparent border-none outline-none focus:ring-0 w-[240px] truncate"
        />

        <div className="flex-1" />

        {/* Saved indicator */}
        {lastSaved && (
          <span className="text-[11.5px] text-[var(--gray-9)] flex items-center gap-1.5">
            <LuCheck className="h-3.5 w-3.5 text-green-500" strokeWidth={2} />
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

        {/* Active toggle */}
        <button
          onClick={handleToggleActive}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
            workflow.active
              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
          )}
        >
          {workflow.active ? (
            <LuZap className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <LuZapOff className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          {workflow.active ? 'Active' : 'Inactive'}
        </button>
      </header>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative overflow-clip">
        {/* Left: node palette */}
        <N8NNodesList />

        {/* Centre: canvas */}
        <WorkflowCanvas workflow={workflow} onChange={handleChange} />

        {/* Right: node properties panel */}
        {selectedNode && (
          <N8NNodeRegistry
            node={selectedNode}
            onUpdate={(changes) =>
              setWorkflow((prev) => ({
                ...prev,
                nodes: prev.nodes.map((n) =>
                  n.id === selectedNode.id
                    ? { ...n, ...changes }
                    : n,
                ),
              }))
            }
            onDelete={() => {
              const name = selectedNode.name;
              setWorkflow((prev) => ({
                ...prev,
                nodes: prev.nodes.filter((n) => n.id !== selectedNode.id),
                connections: prev.connections.filter(
                  (c) =>
                    c.sourceNodeName !== name && c.targetNodeName !== name,
                ),
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * WorkflowEditor — the public-facing n8n-style workflow editor.
 *
 * Wraps EditorContent in WorkflowProvider so all children share
 * pan/zoom, draft-connection, and selection state.
 */
export function WorkflowEditor(props: Props) {
  return (
    <WorkflowProvider>
      <EditorContent {...props} />
    </WorkflowProvider>
  );
}
