import * as React from 'react';
import Link from 'next/link';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Gauge,
    ArrowRight,
    Plus,
} from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    StatCard,
    Badge,
    Separator,
} from '@/components/sabcrm/20ui';

import {
    listSabmonitorChecks,
    listSabmonitorIncidents,
} from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from './_components/status-badge';

export const dynamic = 'force-dynamic';

const SEVERITY_TONE = {
    critical: 'danger',
    major: 'warning',
    minor: 'neutral',
} as const;

export default async function SabmonitorOverviewPage(): Promise<React.JSX.Element> {
    const [checksRes, ongoingRes] = await Promise.all([
        listSabmonitorChecks({ status: 'all', limit: 100 }),
        listSabmonitorIncidents({ status: 'ongoing', limit: 25 }),
    ]);

    const counts = { up: 0, down: 0, warning: 0, unknown: 0 };
    for (const c of checksRes.items) {
        const s = (c.lastStatus ?? 'unknown') as keyof typeof counts;
        counts[s] = (counts[s] ?? 0) + 1;
    }
    const total = checksRes.items.length;
    const reporting = counts.up + counts.down + counts.warning;
    const healthPct = reporting > 0 ? (counts.up / reporting) * 100 : 0;

    const stats: Array<{
        label: string;
        value: number;
        icon: React.ReactNode;
        accent?: string;
    }> = [
        { label: 'Monitors', value: total, icon: <Activity aria-hidden="true" />, accent: '#3b7af5' },
        { label: 'Up', value: counts.up, icon: <CheckCircle2 aria-hidden="true" />, accent: '#1f9d55' },
        { label: 'Down', value: counts.down, icon: <XCircle aria-hidden="true" />, accent: '#dc2626' },
        { label: 'Degraded', value: counts.warning, icon: <AlertTriangle aria-hidden="true" />, accent: '#d97706' },
    ];

    return (
        <div className="flex max-w-[1100px] flex-col gap-5">
            {/* KPI strip — overall fleet health at a glance */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((s) => (
                    <StatCard
                        key={s.label}
                        label={s.label}
                        value={<span className="tabular-nums">{s.value}</span>}
                        icon={s.icon}
                        accent={s.accent}
                    />
                ))}
            </div>

            {/* Fleet health summary band */}
            <Card>
                <CardBody>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span
                                className="grid h-10 w-10 place-items-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                                aria-hidden="true"
                            >
                                <Gauge className="h-5 w-5" />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-[13px] text-[var(--st-text-secondary)]">
                                    Reporting health
                                </span>
                                <span className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--st-text)]">
                                    {healthPct.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
                            <Badge tone="success" kind="soft" dot>
                                {counts.up} up
                            </Badge>
                            {counts.warning > 0 && (
                                <Badge tone="warning" kind="soft" dot>
                                    {counts.warning} degraded
                                </Badge>
                            )}
                            {counts.down > 0 && (
                                <Badge tone="danger" kind="soft" dot>
                                    {counts.down} down
                                </Badge>
                            )}
                            {counts.unknown > 0 && (
                                <span className="inline-flex items-center gap-1">
                                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                    {counts.unknown} pending
                                </span>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Ongoing incidents */}
            <Card padding="none">
                <CardHeader className="flex items-center justify-between px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertTriangle
                            className="h-4 w-4 text-[var(--st-danger)]"
                            aria-hidden="true"
                        />
                        Ongoing incidents
                    </CardTitle>
                    <Link
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--st-accent)] transition-colors hover:text-[var(--st-accent-hover)]"
                        href="/dashboard/sabmonitor/incidents"
                    >
                        View all
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {ongoingRes.items.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            tone="success"
                            size="sm"
                            title="No ongoing incidents"
                            description="Every reporting monitor is healthy right now."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {ongoingRes.items.map((i) => (
                                <li
                                    key={i._id}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <span className="truncate text-sm font-medium text-[var(--st-text)]">
                                            Check {i.checkId}
                                        </span>
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                                            Started{' '}
                                            <time dateTime={i.startedAt}>
                                                {new Date(i.startedAt).toLocaleString()}
                                            </time>
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge
                                            tone={SEVERITY_TONE[i.severity] ?? 'neutral'}
                                            kind="soft"
                                        >
                                            {i.severity}
                                        </Badge>
                                        <StatusBadge status="ongoing" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            {/* Monitors at a glance */}
            <Card padding="none">
                <CardHeader className="flex items-center justify-between px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Monitors
                    </CardTitle>
                    <Link
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--st-accent)] transition-colors hover:text-[var(--st-accent-hover)]"
                        href="/dashboard/sabmonitor/checks"
                    >
                        Manage all
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {checksRes.items.length === 0 ? (
                        <EmptyState
                            icon={Gauge}
                            title="No monitors yet"
                            description="Add your first check to start tracking uptime and latency across regions."
                            action={
                                <Link
                                    className="u-btn u-btn--primary u-btn--md"
                                    href="/dashboard/sabmonitor/checks/new"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">Add monitor</span>
                                </Link>
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {checksRes.items.slice(0, 8).map((c) => (
                                <li
                                    key={c._id}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <Link
                                            className="truncate text-sm font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                            href={`/dashboard/sabmonitor/checks/${c._id}`}
                                        >
                                            {c.name}
                                        </Link>
                                        <span className="truncate text-[12px] text-[var(--st-text-secondary)]">
                                            <span className="uppercase tracking-wide">{c.kind}</span>
                                            {' · '}
                                            {c.url ?? c.host ?? 'No target'}
                                        </span>
                                    </div>
                                    <StatusBadge status={c.lastStatus ?? 'unknown'} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
