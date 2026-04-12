'use client';

/**
 * SabPageShell — the "Aurora premium" page wrapper.
 *
 * Renders a relative stacking context, drops a SabMeshBackground behind
 * the content, and applies the `.sab-shell` class that triggers the page
 * entrance cascade defined in globals.css.
 *
 * Usage:
 *
 *   <SabPageShell>
 *     <SabPageHeader hero title="Project overview" ... />
 *     <div className="grid ...">
 *       <SabStat hero ... />
 *       ...
 *     </div>
 *     <SabCard variant="hero" glow="primary">...</SabCard>
 *   </SabPageShell>
 *
 * The children structure is up to you — SabPageShell only provides the
 * outer atmosphere. Use `<SabPage>` inside for max-width constraints.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SabMeshBackground } from './sab-mesh-background';

export interface SabPageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Disable the mesh/grain atmosphere, keep just the entrance cascade. */
  plain?: boolean;
  /** Disable the mesh animation (keeps it static). */
  staticMesh?: boolean;
  /** Max width of the inner content wrapper. */
  maxWidth?: 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
}

const MAX_WIDTH_CLASS: Record<NonNullable<SabPageShellProps['maxWidth']>, string> = {
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-[1600px]',
  full: 'max-w-none',
};

export function SabPageShell({
  plain,
  staticMesh,
  maxWidth = '2xl',
  className,
  children,
  style,
  ...props
}: SabPageShellProps) {
  return (
    <div
      className={cn('sab-shell relative isolate min-h-full', className)}
      style={{
        fontFamily: 'var(--sab-font-sans)',
        color: 'hsl(var(--sab-fg))',
        ...style,
      }}
      {...props}
    >
      {!plain ? <SabMeshBackground animate={!staticMesh} /> : null}

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full flex-col gap-8',
          MAX_WIDTH_CLASS[maxWidth],
        )}
      >
        {children}
      </div>
    </div>
  );
}
