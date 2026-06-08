/**
 * `/dashboard/requests/analytics` - SLA + decision-time dashboard.
 *
 * Pure server-rendered card grid driven by `getRequestsAnalytics`.
 */
import * as React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Gauge,
    Inbox,
    Timer,
    XCircle,
} from 'lucide-react';

import {
    Badge,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';
import { getRequestsAnalytics } from '@/app/actions/sabrequests.actions';

export const dynamic = 'force-dynamic';

function pct(n: number) {
    return `${Math.round(n * 1000) / 10}%`;
}

const TOTAL_TILES = [
    { key: 'pending', label: 'Pending', icon: Clock, accent: 'var(--st-warn)' },
    { key: 'approved', label: 'Approved', icon: CheckCircle2, accent: 'var(--st-status-ok)' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, accent: 'var(--st-danger)' },
    { key: 'cancelled', label: 'Cancelled', icon: Inbox, accent: 'var(--st-text-tertiary)' },
] as const;

export default async function RequestsAnalyticsPage() {
    const res = await getRequestsAnalytics();
    const a = res.data;
    if (!a) {
        return (
            <div className="20ui p-6">
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={Gauge}
                            title="No analytics available yet"
                            description={res.error ?? 'Check back once requests start flowing through your blueprints.'}
                        />
                    </CardBody>
                </Card>
            </div>
        );
    }
    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Request analytics</PageTitle>
                    <PageDescription>
                        SLA breach rate, decision time, and bottleneck stages.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {TOTAL_TILES.map((t) => (
                    <StatCard
                        key={t.key}
                        label={t.label}
                        value={a.totals[t.key]}
                        icon={t.icon}
                        accent={t.accent}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <StatCard
                    label="SLA breach rate"
                    value={pct(a.slaBreachRate)}
                    icon={AlertTriangle}
                    accent="var(--st-danger)"
                />
                <StatCard
                    label="Average decision time"
                    value={
                        a.avgDecisionMinutes != null
                            ? `${Math.round(a.avgDecisionMinutes)} min`
                            : '-'
                    }
                    icon={Timer}
                    accent="var(--st-accent)"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>By blueprint</CardTitle>
                </CardHeader>
                <CardBody>
                    {a.byBlueprint.length === 0 ? (
                        <EmptyState
                            icon={Inbox}
                            size="sm"
                            title="No data"
                            description="Requests grouped by blueprint will appear here."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {a.byBlueprint.map((b) => (
                                <li
                                    key={b.blueprintId}
                                    className="flex items-center justify-between py-2"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-[var(--st-text)]">
                                            {b.blueprintName ?? 'Untitled blueprint'}
                                        </div>
                                        <div className="text-xs text-[var(--st-text-secondary)]">
                                            {b.count} requests
                                        </div>
                                    </div>
                                    <Badge
                                        tone={b.breachedCount > 0 ? 'danger' : 'neutral'}
                                        kind={b.breachedCount > 0 ? 'soft' : 'outline'}
                                    >
                                        {b.breachedCount} breached
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bottleneck stages</CardTitle>
                </CardHeader>
                <CardBody>
                    {a.bottleneckStages.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            size="sm"
                            tone="success"
                            title="Nothing waiting"
                            description="No stages are currently backed up."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {a.bottleneckStages.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex items-center justify-between py-2"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-[var(--st-text)]">
                                            {s.blueprintName ?? 'Untitled blueprint'} . stage{' '}
                                            {s.stageIdx + 1}
                                            {s.stageName ? ` (${s.stageName})` : ''}
                                        </div>
                                    </div>
                                    <Badge tone="warning">{s.pendingCount} pending</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
