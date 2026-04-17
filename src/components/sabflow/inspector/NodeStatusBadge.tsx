'use client';

/**
 * NodeStatusBadge — small status pill subscribed to the nodeData store.
 *
 *   idle    — hidden (returns null)
 *   running — amber, pulsing spinner
 *   success — emerald, check mark
 *   error   — red, X mark
 *   waiting — sky-blue, timer
 *
 * Used:
 *   • Top-left corner of BlockNode canvas cards.
 *   • Next to the node name inside the inspector header.
 */

import { memo } from 'react';
import {
  LuLoader,
  LuCircleCheck,
  LuCircleX,
  LuTimer,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';
import type { NodeExecutionStatus } from '@/lib/sabflow/execution/nodeData';

type BadgeSize = 'xs' | 'sm';

interface Props {
  nodeId: string;
  size?: BadgeSize;
  /** When true, the badge renders even for `idle` (useful in the inspector header). */
  showIdle?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<BadgeSize, { pill: string; icon: string; text: string }> = {
  xs: { pill: 'h-4 px-1 gap-0.5',    icon: 'h-2.5 w-2.5', text: 'text-[9px]' },
  sm: { pill: 'h-5 px-1.5 gap-1',    icon: 'h-3 w-3',     text: 'text-[10.5px]' },
};

const STATUS_STYLES: Record<
  NodeExecutionStatus,
  { bg: string; fg: string; ring: string; label: string }
> = {
  idle: {
    bg: 'bg-[var(--gray-3)]',
    fg: 'text-[var(--gray-10)]',
    ring: 'ring-1 ring-[var(--gray-5)]',
    label: 'Idle',
  },
  running: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    fg: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-1 ring-amber-400/40',
    label: 'Running',
  },
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    fg: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-1 ring-emerald-500/30',
    label: 'Success',
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    fg: 'text-red-700 dark:text-red-300',
    ring: 'ring-1 ring-red-500/30',
    label: 'Error',
  },
  waiting: {
    bg: 'bg-sky-100 dark:bg-sky-950/40',
    fg: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-1 ring-sky-500/30',
    label: 'Waiting',
  },
};

function StatusIcon({
  status,
  iconCls,
}: {
  status: NodeExecutionStatus;
  iconCls: string;
}) {
  switch (status) {
    case 'running':
      return <LuLoader className={cn(iconCls, 'animate-spin')} strokeWidth={2.25} />;
    case 'success':
      return <LuCircleCheck className={iconCls} strokeWidth={2.25} />;
    case 'error':
      return <LuCircleX className={iconCls} strokeWidth={2.25} />;
    case 'waiting':
      return <LuTimer className={iconCls} strokeWidth={2.25} />;
    default:
      // Hollow dot for idle
      return (
        <span
          className={cn(
            iconCls,
            'rounded-full border border-current inline-block',
          )}
        />
      );
  }
}

function NodeStatusBadgeImpl({
  nodeId,
  size = 'xs',
  showIdle = false,
  className,
}: Props) {
  // Fine-grained subscription — only re-renders when this node's status flips.
  const status = useNodeDataStore((s) => s.data.get(nodeId)?.status ?? 'idle');

  if (status === 'idle' && !showIdle) return null;

  const sz = SIZE_CLASSES[size];
  const style = STATUS_STYLES[status];
  const isPulsing = status === 'running';

  return (
    <span
      role="status"
      aria-label={style.label}
      title={style.label}
      className={cn(
        'inline-flex items-center rounded-full font-medium leading-none',
        sz.pill,
        sz.text,
        style.bg,
        style.fg,
        style.ring,
        isPulsing && 'animate-pulse',
        className,
      )}
    >
      <StatusIcon status={status} iconCls={sz.icon} />
      {size === 'sm' && <span>{style.label}</span>}
    </span>
  );
}

export const NodeStatusBadge = memo(NodeStatusBadgeImpl);
