import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { Card } from '@/components/sabcrm/20ui/compat';

export interface HubKpi {
    label: string;
    value: string | number;
    icon: React.ElementType;
    href?: string;
    hint?: string;
    tone?: 'default' | 'success' | 'warning' | 'danger';
}

const toneClass: Record<NonNullable<HubKpi['tone']>, string> = {
    default: 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
    success: 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]',
    warning: 'bg-[var(--st-warn)]/15 text-[var(--st-warn)]',
    danger: 'bg-[var(--st-danger)]/10 text-[var(--st-danger)]',
};

export function HubKpiGrid({ kpis }: { kpis: HubKpi[] }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
                const Icon = kpi.icon;
                const tone = kpi.tone ?? 'default';
                const inner = (
                    <Card className="h-full p-5">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                                {kpi.label}
                            </p>
                            <span
                                className={`flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] ${toneClass[tone]}`}
                            >
                                <Icon className="h-4 w-4" strokeWidth={1.75} />
                            </span>
                        </div>
                        <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-[var(--st-text)]">
                            {kpi.value}
                        </p>
                        {kpi.hint ? (
                            <p className="mt-2 text-[12px] text-[var(--st-text-secondary)]">{kpi.hint}</p>
                        ) : null}
                    </Card>
                );
                return kpi.href ? (
                    <Link key={kpi.label} href={kpi.href} className="block">
                        {inner}
                    </Link>
                ) : (
                    <div key={kpi.label}>{inner}</div>
                );
            })}
        </div>
    );
}

export interface HubQuickLink {
    href: string;
    title: string;
    description: string;
    icon: React.ElementType;
}

export function HubQuickLinkGrid({ links }: { links: HubQuickLink[] }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {links.map((link) => {
                const Icon = link.icon;
                return (
                    <Link key={link.href} href={link.href} className="group">
                        <Card className="h-full p-5 transition-shadow group-hover:shadow-[var(--st-shadow-md)]">
                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[14px] font-medium text-[var(--st-text)]">{link.title}</p>
                                <ArrowUpRight className="h-4 w-4 text-[var(--st-text-secondary)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--st-text)]" />
                            </div>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--st-text-secondary)]">
                                {link.description}
                            </p>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}

export interface HubRecentRow {
    id: string;
    primary: React.ReactNode;
    secondary?: React.ReactNode;
    trailing?: React.ReactNode;
    href?: string;
}

export function HubRecentList({
    title,
    rows,
    emptyHint,
    viewAllHref,
}: {
    title: string;
    rows: HubRecentRow[];
    emptyHint?: string;
    viewAllHref?: string;
}) {
    return (
        <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-medium text-[var(--st-text)]">{title}</h2>
                {viewAllHref ? (
                    <Link
                        href={viewAllHref}
                        className="text-[12.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        View all
                    </Link>
                ) : null}
            </div>
            {rows.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                    {emptyHint ?? 'Nothing yet.'}
                </p>
            ) : (
                <ul className="divide-y divide-[var(--st-border)]">
                    {rows.map((row) => {
                        const body = (
                            <div className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] text-[var(--st-text)]">
                                        {row.primary}
                                    </div>
                                    {row.secondary ? (
                                        <div className="mt-0.5 truncate text-[12px] text-[var(--st-text-secondary)]">
                                            {row.secondary}
                                        </div>
                                    ) : null}
                                </div>
                                {row.trailing ? (
                                    <div className="shrink-0 text-[12.5px] text-[var(--st-text-secondary)]">
                                        {row.trailing}
                                    </div>
                                ) : null}
                            </div>
                        );
                        return (
                            <li key={row.id}>
                                {row.href ? (
                                    <Link href={row.href} className="block hover:bg-[var(--st-bg-muted)]">
                                        {body}
                                    </Link>
                                ) : (
                                    body
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
