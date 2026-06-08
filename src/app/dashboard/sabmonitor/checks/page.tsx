import * as React from 'react';
import Link from 'next/link';
import { Plus, ListChecks } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { listSabmonitorChecks, listSabmonitorCheckRuns } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function SabmonitorChecksPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorChecks({ status: 'all', limit: 50 });

    // Cheap uptime estimate. For each check, sample last 200 runs and count up.
    // Real impl will pre-aggregate.
    const uptimeByCheck: Record<string, number> = {};
    await Promise.all(
        res.items.map(async (c) => {
            if (!c._id) return;
            try {
                const runs = await listSabmonitorCheckRuns({ checkId: c._id, limit: 200 });
                if (runs.items.length === 0) {
                    uptimeByCheck[c._id] = 0;
                    return;
                }
                const ups = runs.items.filter((r) => r.status === 'up').length;
                uptimeByCheck[c._id] = (ups / runs.items.length) * 100;
            } catch {
                uptimeByCheck[c._id] = 0;
            }
        }),
    );

    return (
        <div className="20ui flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Checks</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    {/* 20ui Button has no `asChild`, so a navigational link is
                        styled directly with the button classes (primary / md). */}
                    <Link
                        href="/dashboard/sabmonitor/checks/new"
                        className="u-btn u-btn--primary u-btn--md"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New check</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={ListChecks}
                            title="No checks yet"
                            description="Create your first monitor to start tracking uptime."
                            action={
                                <Link
                                    href="/dashboard/sabmonitor/checks/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New check</span>
                                </Link>
                            }
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Kind</Th>
                                    <Th>Target</Th>
                                    <Th>Last status</Th>
                                    <Th>Uptime</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((c) => (
                                    <Tr key={c._id}>
                                        <Td>
                                            <Link
                                                className="font-medium text-[var(--st-text)] hover:underline"
                                                href={`/dashboard/sabmonitor/checks/${c._id}`}
                                            >
                                                {c.name}
                                            </Link>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">{c.kind}</Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {c.url ?? c.host ?? '-'}
                                        </Td>
                                        <Td>
                                            <StatusBadge status={c.lastStatus ?? 'unknown'} />
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {c._id && uptimeByCheck[c._id] !== undefined
                                                ? `${uptimeByCheck[c._id].toFixed(2)}%`
                                                : '-'}
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
