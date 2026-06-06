/*  Server-component-safe (no 'use client' here).                      */
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/sabcrm/20ui';

/* ------------------------------------------------------------------ */
/*  Shared admin page primitives                                       */
/*                                                                     */
/*  Theme: light (slate / amber) — matches the rest of /admin/dashboard*/
/* ------------------------------------------------------------------ */

export function AdminPageHeader({
    title,
    description,
    actions,
    eyebrow,
}: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    eyebrow?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
                {eyebrow && (
                    <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--st-text)]">
                        {eyebrow}
                    </div>
                )}
                <h1 className="text-2xl font-bold text-[var(--st-text)]">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-[var(--st-text)]">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function AdminCard({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                'rounded-2xl border border-[var(--st-border)] bg-white overflow-hidden',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function AdminCardHeader({
    title,
    description,
    icon: Icon,
    children,
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ElementType;
    children?: React.ReactNode;
}) {
    return (
        <div className="px-6 py-4 border-b border-[var(--st-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
                {Icon && <Icon className="h-4 w-4 text-[var(--st-text)] shrink-0" />}
                <div className="min-w-0">
                    {title && (
                        <div className="font-semibold text-[var(--st-text)] text-sm truncate">
                            {title}
                        </div>
                    )}
                    {description && (
                        <div className="text-xs text-[var(--st-text)] truncate">{description}</div>
                    )}
                </div>
            </div>
            {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
        </div>
    );
}

export function AdminEmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: React.ElementType;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            {Icon && (
                <div className="h-12 w-12 rounded-2xl bg-[var(--st-bg-muted)] border border-[var(--st-border)] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
            )}
            <div>
                <p className="text-sm font-medium text-[var(--st-text)]">{title}</p>
                {description && (
                    <p className="mt-1 text-xs text-[var(--st-text)] max-w-md">{description}</p>
                )}
            </div>
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

const STATUS_PRESETS = {
    success: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    pending: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    info: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    danger: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    neutral: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    muted: 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
} as const;

export type AdminStatusTone = keyof typeof STATUS_PRESETS;

export function AdminStatusBadge({
    tone = 'neutral',
    children,
    dot = false,
    className,
}: {
    tone?: AdminStatusTone;
    children: React.ReactNode;
    dot?: boolean;
    className?: string;
}) {
    const dotColor: Record<AdminStatusTone, string> = {
        success: 'bg-[var(--st-bg-muted)]',
        pending: 'bg-[var(--st-bg-muted)]',
        info: 'bg-[var(--st-bg-muted)]',
        danger: 'bg-[var(--st-bg-muted)]',
        neutral: 'bg-[var(--st-bg-muted)]',
        muted: 'bg-[var(--st-bg-muted)]',
    };
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                STATUS_PRESETS[tone],
                className,
            )}
        >
            {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor[tone])} />}
            {children}
        </span>
    );
}

export function AdminTable({
    columns,
    children,
}: {
    columns: Array<string | { label: string; align?: 'left' | 'right' | 'center'; className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[var(--st-border)]">
                        {columns.map((c, i) => {
                            const label = typeof c === 'string' ? c : c.label;
                            const align = typeof c === 'string' ? 'left' : (c.align ?? 'left');
                            const extra = typeof c === 'string' ? '' : (c.className ?? '');
                            return (
                                <th
                                    key={i}
                                    className={cn(
                                        'px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]',
                                        align === 'right' && 'text-right',
                                        align === 'center' && 'text-center',
                                        align === 'left' && 'text-left',
                                        extra,
                                    )}
                                >
                                    {label}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--st-border)]">{children}</tbody>
            </table>
        </div>
    );
}

export function AdminPagination({
    basePath,
    currentPage,
    totalPages,
    queryString = '',
}: {
    basePath: string;
    currentPage: number;
    totalPages: number;
    queryString?: string;
}) {
    const sep = queryString ? `&${queryString}` : '';
    const pages = Math.max(totalPages, 1);
    return (
        <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--st-text)]">
                Page {currentPage} of {pages}
            </span>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={currentPage <= 1}
                    className="border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] disabled:opacity-40"
                >
                    <Link href={`${basePath}?page=${currentPage - 1}${sep}`}>Previous</Link>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={currentPage >= pages}
                    className="border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)] disabled:opacity-40"
                >
                    <Link href={`${basePath}?page=${currentPage + 1}${sep}`}>Next</Link>
                </Button>
            </div>
        </div>
    );
}

export function AdminWarningBanner({
    title,
    children,
}: {
    title: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-5 py-4">
            <div className="h-5 w-5 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                !
            </div>
            <div className="text-sm">
                <p className="font-medium text-[var(--st-text)]">{title}</p>
                {children && <p className="text-xs text-[var(--st-text)]/70 mt-0.5">{children}</p>}
            </div>
        </div>
    );
}

export function AdminMetricGrid({
    items,
    columns = 4,
}: {
    items: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: AdminStatusTone }>;
    columns?: 2 | 3 | 4 | 5 | 6;
}) {
    const colClass = {
        2: 'sm:grid-cols-2',
        3: 'sm:grid-cols-2 lg:grid-cols-3',
        4: 'sm:grid-cols-2 lg:grid-cols-4',
        5: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
        6: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    }[columns];
    return (
        <div className={cn('grid gap-3', colClass)}>
            {items.map((it) => (
                <div
                    key={it.label}
                    className="rounded-2xl border border-[var(--st-border)] bg-white p-4 flex flex-col gap-1"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text)]">
                        {it.label}
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-[var(--st-text)]">
                        {it.value}
                    </div>
                    {it.sub && <div className="text-xs text-[var(--st-text)]">{it.sub}</div>}
                </div>
            ))}
        </div>
    );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--st-border)] bg-white p-3">
            {children}
        </div>
    );
}
