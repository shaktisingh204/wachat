import * as React from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
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

export default async function CheckRunsPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { checkId } = await params;
    const runs = await listSabmonitorCheckRuns({ checkId, limit: 200 });

    // Ascending for the chart.
    const ascending = [...runs.items].reverse();

    return (
        <div className="20ui flex flex-col gap-4">
            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>Recent runs</PageTitle>
                </PageHeaderHeading>
                <Link
                    className="text-[12px] text-[var(--st-accent)] hover:underline"
                    href={`/dashboard/sabmonitor/checks/${checkId}`}
                >
                    Back to check
                </Link>
            </PageHeader>
            <Card padding="none">
                <CardBody className="p-4">
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
                <CardBody className="p-0">
                    {runs.items.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="No runs yet"
                            description="Click Run now to collect a first sample."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Time</Th>
                                    <Th>Region</Th>
                                    <Th>Status</Th>
                                    <Th align="right">Response (ms)</Th>
                                    <Th align="right">HTTP</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {runs.items.map((r) => (
                                    <Tr key={r._id}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {new Date(r.ts).toLocaleString()}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {r.probeRegion}
                                        </Td>
                                        <Td>
                                            <StatusBadge status={r.status} />
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {r.responseMs}
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {r.httpStatusCode ?? '-'}
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
