import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayShellProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * When true (default), children render inside a rounded floating
   * panel on a slightly darker outer background. Set to false for
   * full-bleed pages (chat, builders) where the panel chrome would
   * clip content.
   */
  panelled?: boolean;
}

/**
 * ClayShell — outermost layout primitive. Now expressed entirely in
 * shadcn tokens (`bg-zoru-surface`, `bg-zoru-surface`, `text-zoru-ink`) so
 * it inherits whatever theme the consumer has set rather than the
 * legacy clay palette.
 */
export const ClayShell = React.forwardRef<HTMLDivElement, ClayShellProps>(
  ({ className, panelled = true, children, ...props }, ref) => {
    if (!panelled) {
      return (
        <div
          ref={ref}
          className={cn(
            'relative w-full bg-zoru-surface text-zoru-ink',
            className,
          )}
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
        className="relative w-full bg-zoru-surface text-zoru-ink p-3 md:p-4"
        style={{ fontFamily: 'var(--font-sab-sans), system-ui, sans-serif' }}
        {...props}
      >
        <div
          className={cn(
            'rounded-3xl bg-zoru-surface text-zoru-ink shadow-sm overflow-hidden',
            className,
          )}
        >
          {children}
        </div>
      </div>
    );
  },
);
ClayShell.displayName = 'ClayShell';
