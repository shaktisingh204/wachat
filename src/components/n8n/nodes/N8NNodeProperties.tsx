'use client';

import { useState } from 'react';
import { X, Trash2, SlidersHorizontal } from 'lucide-react';
import {
  Button,
  IconButton,
  Field,
  Input,
  Textarea,
  Switch,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { getNodeMeta } from '../registry';
import { useWorkflow } from '../WorkflowContext';
import type { N8NCanvasNode } from '../types';

type Props = {
  node: N8NCanvasNode;
  onUpdate: (changes: Partial<N8NCanvasNode>) => void;
  onDelete: () => void;
};

/**
 * N8NNodeRegistry - right-side properties panel for a selected node.
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

  const paramEntries = Object.entries(node.parameters);

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--st-border)]">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
          style={{ background: meta.color, color: 'var(--st-text-inverted)' }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)] truncate">
          {meta.label}
        </span>
        <IconButton
          label="Close panel"
          icon={X}
          size="sm"
          onClick={() => setSelectedNodeId(null)}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Name */}
        <Field label="Name">
          <Input
            value={node.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </Field>

        {/* Type (read-only) */}
        <Field label="Type">
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[11.5px] text-[var(--st-text-secondary)] font-mono break-all">
            {node.type}
          </div>
        </Field>

        {/* Description */}
        <div className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-3 py-2.5 text-[11.5px] text-[var(--st-text-secondary)] leading-relaxed">
          {meta.description}
        </div>

        {/* Disabled toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-[var(--st-text)]">Disabled</span>
          <Switch
            checked={Boolean(node.disabled)}
            onCheckedChange={(next) => onUpdate({ disabled: next })}
            aria-label="Disable node"
          />
        </div>

        {/* Notes */}
        <Field label="Notes">
          <Textarea
            value={node.notes ?? ''}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={3}
            placeholder="Add a note about this node."
          />
        </Field>

        {/* Parameters */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
            Parameters
          </span>

          {paramEntries.length > 0 ? (
            <div className="space-y-1.5">
              {paramEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-1.5"
                >
                  <span className="text-[11px] font-mono text-[var(--st-text-secondary)] truncate max-w-[80px]">
                    {k}
                  </span>
                  <span className="text-[var(--st-text-tertiary)]">:</span>
                  <span className="flex-1 text-[11px] text-[var(--st-text)] truncate">
                    {String(v)}
                  </span>
                  <IconButton
                    label={`Remove parameter ${k}`}
                    icon={X}
                    size="sm"
                    onClick={() => handleDeleteParam(k)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              size="sm"
              icon={SlidersHorizontal}
              title="No parameters yet"
              description="Add a key and value below to configure this node."
            />
          )}

          {/* Add parameter row */}
          <div className="flex gap-1.5 mt-2 items-start">
            <Input
              className="w-[80px] font-mono"
              inputSize="sm"
              placeholder="key"
              aria-label="Parameter key"
              value={paramKey}
              onChange={(e) => setParamKey(e.target.value)}
            />
            <Input
              className="flex-1"
              inputSize="sm"
              placeholder="value"
              aria-label="Parameter value"
              value={paramVal}
              onChange={(e) => setParamVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParam()}
            />
            <Button size="sm" onClick={handleAddParam} disabled={!paramKey.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Footer: delete */}
      <div className="border-t border-[var(--st-border)] p-4">
        <Button
          variant="danger"
          block
          iconLeft={Trash2}
          onClick={() => {
            onDelete();
            setSelectedNodeId(null);
          }}
        >
          Delete node
        </Button>
      </div>
    </aside>
  );
}
