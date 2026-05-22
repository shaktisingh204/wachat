'use client';

import { Card, Input, Skeleton } from '@/components/zoruui';
import { Search } from 'lucide-react';

/**
 * <EntityListShell /> — reusable list-page chrome for every CRM / HRM list
 * (per Phase 1A of the CRM frontend rebuild).
 *
 * Composes existing zoru primitives only — no new design tokens.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Title / subtitle           │  viewSwitcher · search · CTA    │  toolbar
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  filters (optional)                                           │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  bulkBar (sticky banner, shown when selection > 0)            │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  children   |   loading skeletons   |   empty <Card>      │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  pagination                                                   │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * @example
 * ```tsx
 * <EntityListShell
 *   title="Invoices"
 *   subtitle="All invoices for FY 2025"
 *   primaryAction={<Button onClick={openNew}>New invoice</Button>}
 *   search={{ value: q, onChange: setQ, placeholder: 'Search invoices…' }}
 *   filters={<StatusFilterChips value={status} onChange={setStatus} />}
 *   bulkBar={selected.length ? <BulkActions ids={selected} /> : null}
 *   empty={<EmptyInvoices onCreate={openNew} />}
 *   loading={isPending}
 *   pagination={<PaginationBar page={page} setPage={setPage} />}
 * >
 *   <InvoicesTable rows={rows} />
 * </EntityListShell>
 * ```
 */

import * as React from 'react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface EntityListShellProps {
    /** Title block (use <CrmPageHeader /> if you want the icon variant). */
    title: string;
    subtitle?: string;
    /** Top-right CTA — usually a "New X" button. */
    primaryAction?: React.ReactNode;
    /** Optional row of filter chips / EntityFormField filters. */
    filters?: React.ReactNode;
    /** Free-text search controlled by parent; pass undefined to hide. */
    search?: { value: string; onChange: (v: string) => void; placeholder?: string };
    /** Bulk-action bar — render when selection.length > 0. */
    bulkBar?: React.ReactNode;
    /** Empty state — rendered when items.length === 0 AND !loading. */
    empty?: React.ReactNode;
    /** Loading skeleton — rendered when loading. */
    loading?: boolean;
    /** Main content (table / grid / list). */
    children: React.ReactNode;
    /** Pagination control. */
    pagination?: React.ReactNode;
    /** Optional view-switcher (table / kanban / calendar). */
    viewSwitcher?: React.ReactNode;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function EntityListShell({
    title,
    subtitle,
    primaryAction,
    filters,
    search,
    bulkBar,
    empty,
    loading,
    children,
    pagination,
    viewSwitcher,
}: EntityListShellProps): React.JSX.Element {
    // When empty state is provided AND we're not loading AND children look empty,
    // we let parents trigger empty by simply not passing children — but the spec
    // says "items.length === 0 AND !loading". Since the shell can't introspect
    // children, parents control this by passing `empty` AND no `children` (or by
    // passing `empty` as a conditional). To keep ergonomics simple: if `empty` is
    // truthy and `loading` is false, we render `empty` IN PLACE OF `children`.
    const showEmpty = Boolean(empty) && !loading;

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Toolbar */}
            <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-2xl font-semibold text-zoru-ink">
                        {title}
                    </h1>
                    {subtitle ? (
                        <p className="mt-1 text-sm text-zoru-ink-muted">{subtitle}</p>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {viewSwitcher ? (
                        <div className="flex items-center">{viewSwitcher}</div>
                    ) : null}
                    {search ? (
                        <div className="w-full sm:w-64">
                            <Input
                                type="search"
                                value={search.value}
                                onChange={(e) => search.onChange(e.target.value)}
                                placeholder={search.placeholder ?? 'Search…'}
                                leadingSlot={<Search aria-hidden="true" />}
                            />
                        </div>
                    ) : null}
                    {primaryAction ? <>{primaryAction}</> : null}
                </div>
            </header>

            {/* Filters row */}
            {filters ? (
                <div className="flex flex-wrap items-center gap-2">{filters}</div>
            ) : null}

            {/* Bulk action sticky banner */}
            {bulkBar ? (
                <div
                    role="region"
                    aria-label="Bulk actions"
                    className="sticky top-0 z-10 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]"
                >
                    {bulkBar}
                </div>
            ) : null}

            {/* Body */}
            {loading ? (
                <div className="space-y-2" aria-live="polite" aria-busy="true">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : showEmpty ? (
                <Card className="flex min-h-[240px] items-center justify-center">
                    <div className="w-full max-w-md text-center">{empty}</div>
                </Card>
            ) : (
                <div>{children}</div>
            )}

            {/* Pagination */}
            {pagination ? <div className="pt-2">{pagination}</div> : null}
        </div>
    );
}
