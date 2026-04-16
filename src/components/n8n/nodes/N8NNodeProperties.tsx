'use client';
import { useState } from 'react';
import { LuX, LuTrash2, LuToggleLeft, LuToggleRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { getNodeMeta } from '../registry';
import { useWorkflow } from '../WorkflowContext';
import type { N8NCanvasNode } from '../types';

type Props = {
  node: N8NCanvasNode;
  onUpdate: (changes: Partial<N8NCanvasNode>) => void;
  onDelete: () => void;
};

/**
 * N8NNodeRegistry — right-side properties panel for a selected node.
 *
 * Named "Registry" to match the import alias used in WorkflowEditor.tsx.
 */
export function N8NNodeRegistry({ node, onUpdate, onDelete }: Props) {
  const meta = getNodeMeta(node.type);
  const { setSelectedNodeId } = useWorkflow();
  const Icon = meta.icon;

  const [paramKey, setParamKey] = useState('');
  const [paramVal, setParamVal] = useState('');

  const handleAddParam = () => {
    if (!paramKey.trim()) return;
    onUpdate({ parameters: { ...node.parameters, [paramKey.trim()]: paramVal } });
    setParamKey('');
    setParamVal('');
  };

  const handleDeleteParam = (key: string) => {
    const next = { ...node.parameters };
    delete next[key];
    onUpdate({ parameters: next });
  };

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[var(--gray-5)] bg-[var(--gray-1)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--gray-4)]">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.color, color: '#fff' }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)] truncate">
          {meta.label}
        </span>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          title="Close panel"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
            Name
          </label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[12.5px] text-[var(--gray-12)] outline-none focus:border-[#f76808]"
          />
        </div>

        {/* Type (read-only) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
            Type
          </label>
          <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[11.5px] text-[var(--gray-10)] font-mono break-all">
            {node.type}
          </div>
        </div>

        {/* Description */}
        <div className="rounded-lg bg-[var(--gray-3)] px-3 py-2.5 text-[11.5px] text-[var(--gray-10)] leading-relaxed">
          {meta.description}
        </div>

        {/* Disabled toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-[var(--gray-11)]">Disabled</span>
          <button
            onClick={() => onUpdate({ disabled: !node.disabled })}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
              node.disabled
                ? 'bg-[var(--gray-4)] text-[var(--gray-9)]'
                : 'bg-green-100 text-green-700',
            )}
          >
            {node.disabled ? (
              <LuToggleLeft className="h-4 w-4" strokeWidth={2} />
            ) : (
              <LuToggleRight className="h-4 w-4" strokeWidth={2} />
            )}
            {node.disabled ? 'Off' : 'On'}
          </button>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
            Notes
          </label>
          <textarea
            value={node.notes ?? ''}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={3}
            placeholder="Add a note about this node…"
            className="w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[12px] text-[var(--gray-12)] outline-none focus:border-[#f76808] resize-none"
          />
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gray-9)]">
            Parameters
          </label>

          {Object.entries(node.parameters).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(node.parameters).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5"
                >
                  <span className="text-[11px] font-mono text-[var(--gray-10)] truncate max-w-[80px]">
                    {k}
                  </span>
                  <span className="text-[var(--gray-7)]">:</span>
                  <span className="flex-1 text-[11px] text-[var(--gray-12)] truncate">
                    {String(v)}
                  </span>
                  <button
                    onClick={() => handleDeleteParam(k)}
                    className="shrink-0 text-[var(--gray-8)] hover:text-red-500 transition-colors"
                    title="Remove parameter"
                  >
                    <LuX className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11.5px] text-[var(--gray-9)] italic">
              No parameters yet.
            </div>
          )}

          {/* Add parameter row */}
          <div className="flex gap-1.5 mt-2">
            <input
              type="text"
              placeholder="key"
              value={paramKey}
              onChange={(e) => setParamKey(e.target.value)}
              className="w-[80px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1.5 text-[11.5px] font-mono text-[var(--gray-12)] outline-none focus:border-[#f76808]"
            />
            <input
              type="text"
              placeholder="value"
              value={paramVal}
              onChange={(e) => setParamVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParam()}
              className="flex-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1.5 text-[11.5px] text-[var(--gray-12)] outline-none focus:border-[#f76808]"
            />
            <button
              onClick={handleAddParam}
              disabled={!paramKey.trim()}
              className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer: delete */}
      <div className="border-t border-[var(--gray-4)] p-4">
        <button
          onClick={() => {
            onDelete();
            setSelectedNodeId(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600 hover:bg-red-100 transition-colors"
        >
          <LuTrash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Delete node
        </button>
      </div>
    </aside>
  );
}
