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
import { Badge, cn } from '@/components/sabcrm/20ui/compat';
import type { EmailJourneyNode, EmailJourneyNodeType } from '@/lib/email/types';

interface NodeVisualMeta {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Tailwind class for left-edge accent + icon tint. */
  accent: string;
}

export const NODE_META: Record<EmailJourneyNodeType, NodeVisualMeta> = {
  trigger:   { icon: Zap,       label: 'Trigger',   accent: 'text-[var(--st-text)]' },
  email:     { icon: Mail,      label: 'Email',     accent: 'text-[var(--st-text)]' },
  wait:      { icon: Clock,     label: 'Wait',      accent: 'text-[var(--st-text)]' },
  condition: { icon: GitBranch, label: 'Condition', accent: 'text-[var(--st-text)]' },
  action:    { icon: Wand2,     label: 'Action',    accent: 'text-[var(--st-text)]' },
  split:     { icon: Split,     label: 'A/B split', accent: 'text-[var(--st-text)]' },
  exit:      { icon: Flag,      label: 'Exit',      accent: 'text-[var(--st-text)]' },
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
  const meta = NODE_META[node.type] ?? { icon: Activity, label: node.type, accent: 'text-[var(--st-text)]' };
  const Icon = meta.icon;
  const summary = nodeSummary(node);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative w-full max-w-md rounded-xl border bg-[var(--st-bg-secondary)] px-4 py-3 text-left shadow-sm transition',
        'hover:border-[var(--st-text-secondary)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]',
        selected ? 'border-[var(--st-accent)] ring-1 ring-[var(--st-accent)]' : 'border-[var(--st-border)]',
      )}
    >
      <span className="absolute -left-2 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[10px] font-medium tabular-nums">
        {index + 1}
      </span>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]', meta.accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{meta.label}</Badge>
            {node.data.label ? (
              <span className="truncate text-sm font-medium">{node.data.label}</span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--st-text-secondary)] line-clamp-2">{summary}</p>
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
