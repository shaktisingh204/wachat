'use client';

import {
  Activity,
  Clock,
  Flag,
  GitBranch,
  Mail,
  Split,
  Wand2,
  Zap,
} from 'lucide-react';
import { Badge, cn } from '@/components/zoruui';
import type { EmailJourneyNode, EmailJourneyNodeType } from '@/lib/email/types';

interface NodeVisualMeta {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Tailwind class for left-edge accent + icon tint. */
  accent: string;
}

export const NODE_META: Record<EmailJourneyNodeType, NodeVisualMeta> = {
  trigger:   { icon: Zap,       label: 'Trigger',   accent: 'text-amber-500' },
  email:     { icon: Mail,      label: 'Email',     accent: 'text-blue-500' },
  wait:      { icon: Clock,     label: 'Wait',      accent: 'text-violet-500' },
  condition: { icon: GitBranch, label: 'Condition', accent: 'text-emerald-500' },
  action:    { icon: Wand2,     label: 'Action',    accent: 'text-fuchsia-500' },
  split:     { icon: Split,     label: 'A/B split', accent: 'text-rose-500' },
  exit:      { icon: Flag,      label: 'Exit',      accent: 'text-zinc-500' },
};

interface JourneyNodeCardProps {
  node: EmailJourneyNode;
  selected?: boolean;
  onSelect?: () => void;
  /** Index — displayed in the leading badge so the order is obvious. */
  index: number;
}

/**
 * Visual card for a single journey node. The wrapping ladder-canvas connects
 * cards with simple vertical connectors via CSS — no react-flow.
 */
export function JourneyNodeCard({ node, selected, onSelect, index }: JourneyNodeCardProps) {
  const meta = NODE_META[node.type] ?? { icon: Activity, label: node.type, accent: 'text-zinc-500' };
  const Icon = meta.icon;
  const summary = nodeSummary(node);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full max-w-md rounded-xl border bg-zoru-surface-1 px-4 py-3 text-left shadow-sm transition',
        'hover:border-zoru-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-accent',
        selected ? 'border-zoru-accent ring-1 ring-zoru-accent' : 'border-border',
      )}
    >
      <span className="absolute -left-2 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-zoru-surface-2 text-[10px] font-medium tabular-nums">
        {index + 1}
      </span>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2', meta.accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{meta.label}</Badge>
            {node.data.label ? (
              <span className="truncate text-sm font-medium">{node.data.label}</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zoru-ink-muted line-clamp-2">{summary}</p>
        </div>
      </div>
    </button>
  );
}

function nodeSummary(node: EmailJourneyNode): string {
  switch (node.type) {
    case 'trigger':
      return node.data.trigger?.kind
        ? `Enrols when ${humanise(node.data.trigger.kind)}`
        : 'No trigger configured.';
    case 'email':
      return node.data.emailSubject
        ? `Sends "${node.data.emailSubject}"`
        : node.data.emailTemplateId
          ? `Sends template ${node.data.emailTemplateId}`
          : 'No template selected.';
    case 'wait':
      return node.data.waitFor
        ? `Wait ${node.data.waitFor.value} ${node.data.waitFor.unit}`
        : 'Duration not set.';
    case 'condition':
      return node.data.condition
        ? 'Routes "true" / "false" by filter.'
        : 'No filter configured.';
    case 'action':
      return node.data.action?.kind
        ? `Runs action: ${humanise(node.data.action.kind)}`
        : 'No action configured.';
    case 'split':
      return node.data.splitWeights?.length
        ? `Splits ${node.data.splitWeights.join(' / ')}`
        : 'A/B split — even by default.';
    case 'exit':
      return 'Subscriber exits the journey.';
    default:
      return '';
  }
}

function humanise(s: string): string {
  return s.replace(/_/g, ' ');
}
