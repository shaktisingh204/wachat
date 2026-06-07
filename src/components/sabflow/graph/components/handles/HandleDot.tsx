'use client';

import { cn } from '@/lib/utils';

type HandleDotState = 'default' | 'hover' | 'valid-target' | 'invalid-target' | 'connected';

type Props = {
  state: HandleDotState;
  /** Canvas zoom scale, used for zoom compensation. */
  scale: number;
  className?: string;
};

const BASE_SIZE = 16;

/**
 * Circular handle indicator with zoom-compensated sizing.
 *
 * Visual states:
 * - default: transparent ring, appears on parent hover
 * - hover: 1.5x scale, accent fill
 * - valid-target: success glow ring
 * - invalid-target: danger ring
 * - connected: solid filled dot
 */
export function HandleDot({ state, scale, className }: Props) {
  // Zoom compensation: keep the handle the same visual size regardless of zoom.
  // Clamp the compensation so handles don't become absurdly large when zoomed out.
  const compensatedScale = Math.min(Math.max(1 / scale, 0.6), 2.5);
  const size = BASE_SIZE * compensatedScale;

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full transition-all duration-150',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          'rounded-full transition-all duration-150',
          // Size
          state === 'hover' ? 'w-full h-full' : 'w-[75%] h-[75%]',
          // Colors and borders
          state === 'default' &&
            'border-2 border-[var(--st-border-strong)] bg-[var(--st-bg)]',
          state === 'hover' &&
            'border-2 border-[var(--st-border)] bg-[var(--st-accent)] shadow-[0_0_8px_var(--st-accent-ring)]',
          state === 'valid-target' &&
            'border-2 border-[var(--st-status-ok)] bg-[var(--st-status-ok)]/20 shadow-[0_0_10px_var(--st-status-ok)]',
          state === 'invalid-target' &&
            'border-2 border-[var(--st-danger)] bg-[var(--st-danger)]/20',
          state === 'connected' &&
            'border-2 border-[var(--st-accent)] bg-[var(--st-accent)]',
        )}
      />
    </div>
  );
}
