'use client';

import * as React from 'react';
import { m } from 'motion/react';

import { cn } from '@/lib/utils';
import { fadeInUp, springSoft } from '@/lib/motion';

interface PageHeaderProps {
    /** Page title — required, renders in display weight. */
    title: React.ReactNode;
    /** Optional subtitle line under the title. */
    subtitle?: React.ReactNode;
    /** Slot for a breadcrumb component, rendered above the title. */
    breadcrumb?: React.ReactNode;
    /** Slot for action buttons (CTAs, filters, …) on the right side. */
    actions?: React.ReactNode;
    /** Optional Lucide icon component rendered inside a Prism gradient tile. */
    icon?: React.ComponentType<{ className?: string }>;
    /** Disable the animated indigo underline below the title. */
    noUnderline?: boolean;
    /** Render the gradient mesh backdrop behind the header. */
    mesh?: boolean;
    className?: string;
}

/**
 * PageHeader — the canonical hero block at the top of every dashboard
 * page. Supplies title, optional subtitle, breadcrumb slot and action
 * slot, plus an animated Prism underline that grows in on mount.
 */
export function PageHeader({
    title,
    subtitle,
    breadcrumb,
    actions,
    icon: Icon,
    noUnderline,
    mesh,
    className,
}: PageHeaderProps) {
    return (
        <m.header
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className={cn(
                'relative isolate w-full pb-5 mb-4',
                mesh && 'overflow-hidden rounded-2xl px-6 pt-6',
                className
            )}
        >
            {mesh && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 opacity-90"
                    style={{ background: 'var(--prism-mesh)' }}
                />
            )}

            {breadcrumb && <div className="mb-2 text-xs">{breadcrumb}</div>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    {Icon && (
                        <m.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={springSoft}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-md"
                            style={{
                                background: 'var(--prism-gradient)',
                                boxShadow:
                                    '0 8px 16px -8px hsl(var(--prism-indigo) / 0.45), 0 0 24px -4px hsl(var(--prism-violet) / 0.35)',
                            }}
                        >
                            <Icon className="h-5 w-5" />
                        </m.div>
                    )}

                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex items-center gap-2 shrink-0">{actions}</div>
                )}
            </div>

            {!noUnderline && (
                <span
                    aria-hidden
                    className="prism-underline mt-3 block h-[3px] w-16 rounded-full"
                />
            )}
        </m.header>
    );
}
