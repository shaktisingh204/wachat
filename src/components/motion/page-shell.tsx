'use client';

import * as React from 'react';
import { m } from 'motion/react';
import { staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface PageShellProps {
    className?: string;
    children: React.ReactNode;
}

/**
 * A motion-friendly page wrapper that staggers any direct children
 * on mount. Compose it inside a route to get tasteful page entrance
 * cascades without each section needing its own motion plumbing.
 *
 *   <PageShell>
 *     <PageHeader ... />
 *     <StatGrid ... />
 *     <Card ... />
 *   </PageShell>
 *
 * Uses the lazy `m.div` so it won't bloat first paint.
 */
export function PageShell({ className, children }: PageShellProps) {
    return (
        <m.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className={cn('w-full', className)}
        >
            {children}
        </m.div>
    );
}
