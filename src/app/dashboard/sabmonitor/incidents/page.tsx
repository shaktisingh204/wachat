import * as React from 'react';
import { AlertTriangle, Flame, CheckCircle2, ShieldAlert } from 'lucide-react';

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
    Badge,
    Separator,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

import { listSabmonitorIncidents } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';
import { IncidentActions } from '../_components/incident-actions';
import { IncidentFilter } from '../_components/incident-filter';

export const dynamic = 'force-dynamic';

const SEVERITY_TONE = {
    critical: 'danger',
    major: 'warning',
    minor: 'neutral',
} as const;

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

function formatDuration(secs: number): string {
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    return `${(secs / 3600).toFixed(1)}h`;
}

export default async function SabmonitorIncidentsPage({
    searchParams,
}: PageProps): Promise<React.JSX.Element> {
    const sp = await searchParams;
    const status = (sp.status as 'ongoing' | 'resolved' | 'all') ?? 'all';

    const [res, ongoingRes, resolvedRes] = await Promise.all([
        listSabmonitorIncidents({ status, limit: 100 }),
        listSabmonitorIncidents({ status: 'ongoing', limit: 100 }),
        listSabmonitorIncidents({ status: 'resolved', limit: 100 }),
    ]);

    const critical = ongoingRes.items.filter((i) => i.severity === 'critical').length;

    return (
        <div className="flex max-w-[1100px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Incidents</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <IncidentFilter status={status} />
                </PageActions>
            </PageHeader>

            <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                    label="Ongoing"
                    value={<span className="tabular-nums">{ongoingRes.items.length}</span>}
                    icon={<ShieldAlert aria-hidden="true" />}
                    accent="#dc2626"
                />
                <StatCard
                    label="Critical"
                    value={<span className="tabular-nums">{critical}</span>}
                    icon={<Flame aria-hidden="true" />}
                    accent="#d97706"
                />
                <StatCard
                    label="Resolved"
                    value={<span className="tabular-nums">{resolvedRes.items.length}</span>}
                    icon={<CheckCircle2 aria-hidden="true" />}
                    accent="#1f9d55"
                />
            </div>

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <AlertTriangle
                            className="h-4 w-4 text-[var(--st-danger)]"
                            aria-hidden="true"
                        />
                        Incident timeline
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={CheckCircle2}
                            tone="success"
                            title="No incidents"
                            description="Incidents open automatically when a monitor goes down, and resolve when it recovers."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Started</Th>
                                    <Th>Check</Th>
                                    <Th>Severity</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Downtime</Th>
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((i) => (
                                    <Tr key={i._id}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            <time dateTime={i.startedAt}>
                                                {new Date(i.startedAt).toLocaleString()}
                                            </time>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {i.checkId}
                                        </Td>
                                        <Td>
                                            <Badge
                                                tone={SEVERITY_TONE[i.severity] ?? 'neutral'}
                                                kind="soft"
                                            >
                                                {i.severity}
                                            </Badge>
                                        </Td>
                                        <Td>
                                            <StatusBadge status={i.status} />
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {i.downtimeSecs
                                                ? formatDuration(i.downtimeSecs)
                                                : '—'}
                                        </Td>
                                        <Td align="right">
                                            {i._id && <IncidentActions incident={i} />}
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
