'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';

/**
 * Wraps app router pages with a fade in/out transition keyed by
 * pathname. Uses the `m` lightweight motion component (provided
 * by LazyMotion + domAnimation) so it stays small.
 *
 * Place around `{children}` in a client layout — server layouts
 * cannot host this directly because it relies on `usePathname()`.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <m.div
                key={pathname}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
                className="h-full w-full"
            >
                {children}
            </m.div>
        </AnimatePresence>
    );
}
