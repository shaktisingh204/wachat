'use client';

import * as React from 'react';
import { m } from 'motion/react';

import { cn } from '@/lib/utils';
import { fadeInUp, scaleIn } from '@/lib/motion';

interface EmptyStateProps {
    /** Lucide icon, or any React node — rendered inside a Prism gradient tile. */
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
    /** Heading. */
    title: React.ReactNode;
    /** Body copy under the title. */
    description?: React.ReactNode;
    /** Right-aligned CTA button slot. */
    action?: React.ReactNode;
    /** Optional secondary action below the primary one. */
    secondaryAction?: React.ReactNode;
    className?: string;
}

/**
 * EmptyState — what users see when a list/table/grid has no data.
 * Fades in on mount, scales the icon tile in, keeps the layout
 * centred regardless of which slots are filled.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    secondaryAction,
    className,
}: EmptyStateProps) {
    const renderIcon = () => {
        if (!icon) return null;
        if (React.isValidElement(icon)) return icon;
        const Icon = icon as React.ComponentType<{ className?: string }>;
        return <Icon className="h-7 w-7 text-white" />;
    };

    return (
        <m.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className={cn(
                'mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-12 text-center',
                className
            )}
        >
            {icon && (
                <m.div
                    variants={scaleIn}
                    initial="hidden"
                    animate="visible"
                    className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md"
                    style={{
                        background: 'var(--prism-gradient)',
                        boxShadow:
                            '0 8px 16px -8px hsl(var(--prism-indigo) / 0.40), 0 0 24px -4px hsl(var(--prism-violet) / 0.30)',
                    }}
                >
                    {renderIcon()}
                </m.div>
            )}

            <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
            </h3>

            {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}

            {action && <div className="mt-2">{action}</div>}
            {secondaryAction && <div className="mt-1">{secondaryAction}</div>}
        </m.div>
    );
}
