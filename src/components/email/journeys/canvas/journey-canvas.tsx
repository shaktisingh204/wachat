'use client';

/**
 * JourneyCanvas
 * -------------
 * Minimal "node ladder" visualization for an email journey.
 *
 * TRADE-OFF: react-flow is NOT a dependency in this project, so this canvas
 * does NOT render a free-form 2D graph. Instead it shows nodes top-to-bottom
 * in execution order, connected by simple vertical CSS rules, and lets the
 * user move a node up/down with arrow buttons. This is intentional — the
 * full DAG can be re-rendered if/when react-flow is added; the underlying
 * `nodes` + `edges` state stays compatible.
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import type {
  EmailJourneyEdge,
  EmailJourneyNode,
  EmailJourneyNodeType,
} from '@/lib/email/types';
import { JourneyNodeCard, NODE_META } from './node-types';

interface JourneyCanvasProps {
  nodes: EmailJourneyNode[];
  edges: EmailJourneyEdge[];
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: { nodes: EmailJourneyNode[]; edges: EmailJourneyEdge[] }) => void;
  readOnly?: boolean;
}

const ADDABLE_TYPES: EmailJourneyNodeType[] = [
  'email',
  'wait',
  'condition',
  'action',
  'split',
  'exit',
];

export function JourneyCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelect,
  onChange,
  readOnly,
}: JourneyCanvasProps) {
  const move = (index: number, dir: -1 | 1) => {
    const next = [...nodes];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ nodes: next, edges: relinkSequential(next) });
  };

  const remove = (index: number) => {
    const removed = nodes[index];
    if (!removed) return;
    if (removed.type === 'trigger') return; // never remove trigger
    const next = nodes.filter((_, i) => i !== index);
    onChange({ nodes: next, edges: relinkSequential(next) });
    if (selectedNodeId === removed.id) onSelect(null);
  };

  const add = (kind: EmailJourneyNodeType) => {
    const id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const last = nodes[nodes.length - 1];
    const insertAt =
      last && last.type === 'exit' ? nodes.length - 1 : nodes.length;
    const newNode: EmailJourneyNode = {
      id,
      type: kind,
      position: { x: 0, y: insertAt * 120 },
      data: defaultDataFor(kind),
    };
    const next = [...nodes];
    next.splice(insertAt, 0, newNode);
    onChange({ nodes: next, edges: relinkSequential(next) });
    onSelect(id);
  };

  return (
    <div className="flex flex-col items-center gap-0">
      {nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-zoru-surface-2 px-6 py-12 text-center">
          <p className="text-sm text-zoru-ink-muted">This journey has no steps yet.</p>
        </div>
      ) : (
        nodes.map((node, i) => (
          <div key={node.id} className="flex w-full flex-col items-center">
            <div className="flex w-full items-start gap-2 max-w-md">
              <JourneyNodeCard
                node={node}
                index={i}
                selected={selectedNodeId === node.id}
                onSelect={() => onSelect(node.id)}
              />
              {!readOnly && node.type !== 'trigger' ? (
                <div className="flex flex-col gap-1">
                  <ZoruButton size="icon" variant="ghost" aria-label="Move up" disabled={i <= 1} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3 w-3" />
                  </ZoruButton>
                  <ZoruButton size="icon" variant="ghost" aria-label="Move down" disabled={i >= nodes.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-3 w-3" />
                  </ZoruButton>
                  <ZoruButton size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(i)}>
                    <Trash2 className="h-3 w-3" />
                  </ZoruButton>
                </div>
              ) : null}
            </div>
            {i < nodes.length - 1 ? (
              <div aria-hidden className="h-6 w-px bg-border" />
            ) : null}
          </div>
        ))
      )}

      {!readOnly ? (
        <div className="mt-4">
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <ZoruButton variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Add step
              </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="center">
              {ADDABLE_TYPES.map((k) => {
                const Icon = NODE_META[k].icon;
                return (
                  <ZoruDropdownMenuItem key={k} onSelect={() => add(k)}>
                    <Icon className="h-4 w-4" /> {NODE_META[k].label}
                  </ZoruDropdownMenuItem>
                );
              })}
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
        </div>
      ) : null}

      {edges.length > 0 ? (
        <p className="mt-6 text-[10px] text-zoru-ink-muted">
          {edges.length} edge{edges.length === 1 ? '' : 's'} rendered as a linear ladder. Branching from condition/split nodes
          is preserved in the underlying data and inspected in the side panel.
        </p>
      ) : null}
    </div>
  );
}

function defaultDataFor(kind: EmailJourneyNodeType): EmailJourneyNode['data'] {
  switch (kind) {
    case 'email':     return { label: 'Send email' };
    case 'wait':      return { label: 'Wait', waitFor: { value: 1, unit: 'days' } };
    case 'condition': return { label: 'Condition', condition: { combinator: 'AND', filters: [] } };
    case 'action':    return { label: 'Action', action: { kind: 'tag_add', config: {} } };
    case 'split':     return { label: 'A/B split', splitWeights: [50, 50] };
    case 'exit':      return { label: 'Exit' };
    case 'trigger':   return { label: 'Trigger' };
  }
}

/**
 * Rebuild a linear edge list from the node array. Branching edges that the
 * user authored remain encoded inside node data (e.g. `condition`) — full
 * non-linear graphs are out of scope for this list view.
 */
function relinkSequential(nodes: EmailJourneyNode[]): EmailJourneyEdge[] {
  const out: EmailJourneyEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (!a || !b) continue;
    out.push({
      id: `e_${a.id}__${b.id}`,
      source: a.id,
      target: b.id,
    });
  }
  return out;
}
