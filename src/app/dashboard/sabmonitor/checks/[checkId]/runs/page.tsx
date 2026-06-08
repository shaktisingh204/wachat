import * as React from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, Gauge, Timer, TrendingUp, CheckCircle2 } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    StatCard,
    Separator,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

import { listSabmonitorCheckRuns } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../../../_components/status-badge';
import { ResponseTimeChart } from '../../../_components/response-time-chart';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ checkId: string }>;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}

export default async function CheckRunsPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { checkId } = await params;
    const runs = await listSabmonitorCheckRuns({ checkId, limit: 200 });

    // Ascending for the chart.
    const ascending = [...runs.items].reverse();

    const times = runs.items.map((r) => r.responseMs).sort((a, b) => a - b);
    const avg =
        times.length > 0 ? Math.round(times.reduce((s, v) => s + v, 0) / times.length) : 0;
    const p95 = Math.round(percentile(times, 95));
    const ups = runs.items.filter((r) => r.status === 'up').length;
    const uptime = runs.items.length > 0 ? (ups / runs.items.length) * 100 : 0;

    return (
        <div className="flex max-w-[1000px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Recent runs</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        className="u-btn u-btn--ghost u-btn--md"
                        href={`/dashboard/sabmonitor/checks/${checkId}`}
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to monitor</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {runs.items.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="Uptime"
                        value={<span className="tabular-nums">{uptime.toFixed(2)}%</span>}
                        icon={<CheckCircle2 aria-hidden="true" />}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Avg response"
                        value={
                            <span className="tabular-nums">
                                {avg}
                                <span className="ml-0.5 text-[13px] font-normal text-[var(--st-text-secondary)]">
                                    ms
                                </span>
                            </span>
                        }
                        icon={<Timer aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="p95 response"
                        value={
                            <span className="tabular-nums">
                                {p95}
                                <span className="ml-0.5 text-[13px] font-normal text-[var(--st-text-secondary)]">
                                    ms
                                </span>
                            </span>
                        }
                        icon={<TrendingUp aria-hidden="true" />}
                        accent="#7c3aed"
                    />
                    <StatCard
                        label="Samples"
                        value={<span className="tabular-nums">{runs.items.length}</span>}
                        icon={<Gauge aria-hidden="true" />}
                    />
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Response time
                    </CardTitle>
                </CardHeader>
                <CardBody>
                    <ResponseTimeChart
                        points={ascending.map((r) => ({
                            ts: r.ts,
                            ms: r.responseMs,
                            status: r.status,
                        }))}
                    />
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Timer className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        Run history
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {runs.items.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="No runs yet"
                            description="Trigger a manual run from the monitor to collect a first sample."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Time</Th>
                                    <Th>Region</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Response</Th>
                                    <Th align="right">HTTP</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {runs.items.map((r) => (
                                    <Tr key={r._id}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            <time dateTime={r.ts}>
                                                {new Date(r.ts).toLocaleString()}
                                            </time>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {r.probeRegion}
                                        </Td>
                                        <Td>
                                            <StatusBadge status={r.status} />
                                        </Td>
                                        <Td align="right" className="tabular-nums text-[var(--st-text)]">
                                            {r.responseMs} ms
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {r.httpStatusCode ?? '—'}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
