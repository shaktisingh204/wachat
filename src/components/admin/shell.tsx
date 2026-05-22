import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/zoruui';

/* ------------------------------------------------------------------ */
/*  Shared admin page primitives                                       */
/*                                                                     */
/*  Theme: light (slate / amber) — matches the rest of /admin/dashboard*/
/*  Server-component-safe (no 'use client' here).                      */
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
                    <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-600">
                        {eyebrow}
                    </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                {description && (
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
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
                'rounded-2xl border border-slate-200 bg-white overflow-hidden',
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
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
                {Icon && <Icon className="h-4 w-4 text-slate-500 shrink-0" />}
                <div className="min-w-0">
                    {title && (
                        <div className="font-semibold text-slate-900 text-sm truncate">
                            {title}
                        </div>
                    )}
                    {description && (
                        <div className="text-xs text-slate-500 truncate">{description}</div>
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
                <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-400" />
                </div>
            )}
            <div>
                <p className="text-sm font-medium text-slate-700">{title}</p>
                {description && (
                    <p className="mt-1 text-xs text-slate-500 max-w-md">{description}</p>
                )}
            </div>
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

const STATUS_PRESETS = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    pending: 'border-amber-200 bg-amber-50 text-amber-600',
    info: 'border-blue-200 bg-blue-50 text-blue-600',
    danger: 'border-red-200 bg-red-50 text-red-600',
    neutral: 'border-slate-300 bg-slate-100 text-slate-700',
    muted: 'border-slate-200 bg-slate-50 text-slate-500',
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
        success: 'bg-emerald-400',
        pending: 'bg-amber-400',
        info: 'bg-blue-400',
        danger: 'bg-red-400',
        neutral: 'bg-slate-400',
        muted: 'bg-slate-300',
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
                    <tr className="border-b border-slate-200">
                        {columns.map((c, i) => {
                            const label = typeof c === 'string' ? c : c.label;
                            const align = typeof c === 'string' ? 'left' : (c.align ?? 'left');
                            const extra = typeof c === 'string' ? '' : (c.className ?? '');
                            return (
                                <th
                                    key={i}
                                    className={cn(
                                        'px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500',
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
                <tbody className="divide-y divide-slate-200">{children}</tbody>
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
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
                Page {currentPage} of {pages}
            </span>
            <div className="flex gap-2">
                <ZoruButton
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={currentPage <= 1}
                    className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40"
                >
                    <Link href={`${basePath}?page=${currentPage - 1}${sep}`}>Previous</Link>
                </ZoruButton>
                <ZoruButton
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={currentPage >= pages}
                    className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40"
                >
                    <Link href={`${basePath}?page=${currentPage + 1}${sep}`}>Next</Link>
                </ZoruButton>
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
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="h-5 w-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                !
            </div>
            <div className="text-sm">
                <p className="font-medium text-amber-800">{title}</p>
                {children && <p className="text-xs text-amber-700/70 mt-0.5">{children}</p>}
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
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-1"
                >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {it.label}
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-slate-900">
                        {it.value}
                    </div>
                    {it.sub && <div className="text-xs text-slate-500">{it.sub}</div>}
                </div>
            ))}
        </div>
    );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            {children}
        </div>
    );
}
