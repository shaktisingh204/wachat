import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayShellProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * When true (default), children render inside a rounded
   * floating panel on a slightly darker cream outer background —
   * the pixel-accurate reference layout.
   *
   * Set to false for full-bleed pages (chat, builders) where the
   * panel chrome would clip content.
   */
  panelled?: boolean;
}

/**
 * ClayShell — the outermost layout primitive.
 *
 * Structure:
 *   <div class="clay-outer-shell">     ← darker cream page chrome
 *     <div class="clay-panel">          ← rounded 28px floating panel
 *       {children}
 *     </div>
 *   </div>
 */
export const ClayShell = React.forwardRef<HTMLDivElement, ClayShellProps>(
  ({ className, panelled = true, children, ...props }, ref) => {
    if (!panelled) {
      return (
        <div
          ref={ref}
          className={cn('clay-outer-shell relative w-full', className)}
          style={{ fontFamily: 'var(--font-sab-sans), system-ui, sans-serif' }}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="clay-outer-shell relative w-full p-3 md:p-4"
        style={{ fontFamily: 'var(--font-sab-sans), system-ui, sans-serif' }}
        {...props}
      >
        <div className={cn('clay-panel', className)}>{children}</div>
      </div>
    );
  },
);
ClayShell.displayName = 'ClayShell';
