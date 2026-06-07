'use client';
/**
 * EmptyCanvasOverlay - port of n8n's "Add first step" empty-canvas CTA.
 *
 * Shown when a workflow has zero nodes. Centered card with a single button
 * that pops the node creator (we don't filter to triggers here because SabFlow
 * chats can also start from a regular block).
 */
import { Plus, Sparkles } from 'lucide-react';

import { Button, Card } from '@/components/sabcrm/20ui';

type Props = { onAdd: () => void };

export function EmptyCanvasOverlay({ onAdd }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
      <Card
        variant="outlined"
        padding="lg"
        className="pointer-events-auto max-w-[320px] border-dashed text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.18)]"
      >
        <span
          className="mx-auto mb-3 flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
          aria-hidden="true"
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="mb-1 text-[15px] font-semibold text-[var(--st-text)]">
          Start your workflow
        </div>
        <p className="mb-3.5 text-xs leading-relaxed text-[var(--st-text-secondary)]">
          Add a first step, a trigger, message, or integration, and wire nodes
          together by dragging from a handle.
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={onAdd}>
          Add first step
        </Button>
      </Card>
    </div>
  );
}
