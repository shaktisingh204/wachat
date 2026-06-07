'use client';

/*  Shared admin page primitives, built on pure 20ui.                   */
import React from 'react';
import { useRouter } from 'next/navigation';
import {
    cn,
    Card,
    CardHeader,
    CardBody,
    CardTitle,
    CardDescription,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    EmptyState,
    Alert,
    Badge,
    Pagination,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

/* ------------------------------------------------------------------ */
/*  Shared admin page primitives                                       */
/*                                                                     */
/*  Theme: 20ui (single accent / single radius) across /admin/dashboard*/
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
        <PageHeader>
            <PageHeaderHeading>
                {eyebrow && <PageEyebrow>{eyebrow}</PageEyebrow>}
                <PageTitle>{title}</PageTitle>
                {description && <PageDescription>{description}</PageDescription>}
            </PageHeaderHeading>
            {actions && <PageActions>{actions}</PageActions>}
        </PageHeader>
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
        <Card padding="none" className={cn('overflow-hidden', className)}>
            {children}
        </Card>
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
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
                {Icon && (
                    <Icon
                        aria-hidden="true"
                        className="h-4 w-4 text-[var(--st-text-secondary)] shrink-0"
                    />
                )}
                <div className="min-w-0">
                    {title && <CardTitle className="truncate">{title}</CardTitle>}
                    {description && (
                        <CardDescription className="truncate">{description}</CardDescription>
                    )}
                </div>
            </div>
            {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
        </CardHeader>
    );
}

export function AdminEmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: React.ComponentType<{ size?: number | string }>;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <EmptyState
            icon={Icon}
            title={title}
            description={description}
            action={action}
        />
    );
}

/* Map the admin status tones onto 20ui Badge tones (colour only carries meaning). */
const STATUS_TONE: Record<string, BadgeTone> = {
    success: 'success',
    pending: 'warning',
    info: 'info',
    danger: 'danger',
    neutral: 'neutral',
    muted: 'neutral',
};

export type AdminStatusTone = keyof typeof STATUS_TONE;

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
    const badgeTone = STATUS_TONE[tone] ?? 'neutral';
    return (
        <Badge tone={badgeTone} dot={dot} className={cn('capitalize', className)}>
            {children}
        </Badge>
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
            <Table>
                <THead>
                    <Tr>
                        {columns.map((c, i) => {
                            const label = typeof c === 'string' ? c : c.label;
                            const align = typeof c === 'string' ? 'left' : (c.align ?? 'left');
                            const extra = typeof c === 'string' ? '' : (c.className ?? '');
                            return (
                                <Th key={i} align={align} className={extra || undefined}>
                                    {label}
                                </Th>
                            );
                        })}
                    </Tr>
                </THead>
                <TBody>{children}</TBody>
            </Table>
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
    const router = useRouter();
    const pages = Math.max(totalPages, 1);
    const sep = queryString ? `&${queryString}` : '';
    return (
        <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--st-text-secondary)]">
                Page {currentPage} of {pages}
            </span>
            <Pagination
                page={currentPage}
                pageCount={pages}
                size="compact"
                onPageChange={(next) => router.push(`${basePath}?page=${next}${sep}`)}
            />
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
        <Alert tone="warning" title={title}>
            {children}
        </Alert>
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
                <Card key={it.label} padding="none">
                    <CardBody className="flex flex-col gap-1 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--st-text-secondary)]">
                            {it.label}
                        </div>
                        <div className="text-2xl font-bold tabular-nums text-[var(--st-text)]">
                            {it.value}
                        </div>
                        {it.sub && (
                            <div className="text-xs text-[var(--st-text-secondary)]">{it.sub}</div>
                        )}
                    </CardBody>
                </Card>
            ))}
        </div>
    );
}

export function AdminToolbar({ children }: { children: React.ReactNode }) {
    return (
        <Card padding="sm" className="flex flex-wrap items-center gap-2">
            {children}
        </Card>
    );
}
