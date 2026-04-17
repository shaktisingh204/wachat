'use client';

import { cn } from '@/lib/utils';

type HandleDotState = 'default' | 'hover' | 'valid-target' | 'invalid-target' | 'connected';

type Props = {
  state: HandleDotState;
  /** Canvas zoom scale — used for zoom compensation. */
  scale: number;
  className?: string;
};

const BASE_SIZE = 16;

/**
 * Circular handle indicator with zoom-compensated sizing.
 *
 * Visual states:
 * - default: transparent ring, appears on parent hover
 * - hover: 1.5x scale, orange fill
 * - valid-target: green glow ring
 * - invalid-target: red ring
 * - connected: solid filled dot
 */
export function HandleDot({ state, scale, className }: Props) {
  // Zoom compensation: keep handle the same visual size regardless of zoom.
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
          state === 'hover'
            ? 'w-full h-full'
            : 'w-[75%] h-[75%]',
          // Colors & borders
          state === 'default' &&
            'border-2 border-[var(--gray-7)] bg-[var(--gray-1)]',
          state === 'hover' &&
            'border-2 border-[#f76808] bg-[#f76808] shadow-[0_0_8px_rgba(247,104,8,0.4)]',
          state === 'valid-target' &&
            'border-2 border-[#10b981] bg-[#10b981]/20 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
          state === 'invalid-target' &&
            'border-2 border-[#ef4444] bg-[#ef4444]/20',
          state === 'connected' &&
            'border-2 border-[var(--gray-8)] bg-[var(--gray-8)]',
        )}
      />
    </div>
  );
}
