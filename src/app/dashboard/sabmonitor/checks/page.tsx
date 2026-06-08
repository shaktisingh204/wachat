import * as React from 'react';
import Link from 'next/link';
import { Plus, ListChecks, Activity, CheckCircle2, PauseCircle } from 'lucide-react';

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
    Progress,
    Separator,
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

    const total = res.items.length;
    const active = res.items.filter((c) => c.status === 'active').length;
    const paused = total - active;

    return (
        <div className="flex max-w-[1100px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Monitors</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    {/* 20ui Button has no `asChild`, so a navigational link is
                        styled directly with the button classes (primary / md). */}
                    <Link
                        href="/dashboard/sabmonitor/checks/new"
                        className="u-btn u-btn--primary u-btn--md"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New monitor</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {total > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Total monitors"
                        value={<span className="tabular-nums">{total}</span>}
                        icon={<Activity aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Active"
                        value={<span className="tabular-nums">{active}</span>}
                        icon={<CheckCircle2 aria-hidden="true" />}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Paused"
                        value={<span className="tabular-nums">{paused}</span>}
                        icon={<PauseCircle aria-hidden="true" />}
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <ListChecks
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        All monitors
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={ListChecks}
                            title="No monitors yet"
                            description="Create your first monitor to start tracking uptime and latency."
                            action={
                                <Link
                                    href="/dashboard/sabmonitor/checks/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New monitor</span>
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
                                    <Th align="right">Uptime</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((c) => {
                                    const uptime =
                                        c._id && uptimeByCheck[c._id] !== undefined
                                            ? uptimeByCheck[c._id]
                                            : null;
                                    return (
                                        <Tr key={c._id}>
                                            <Td>
                                                <Link
                                                    className="font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                                    href={`/dashboard/sabmonitor/checks/${c._id}`}
                                                >
                                                    {c.name}
                                                </Link>
                                            </Td>
                                            <Td className="uppercase tracking-wide text-[var(--st-text-secondary)]">
                                                {c.kind}
                                            </Td>
                                            <Td className="max-w-[280px] truncate text-[var(--st-text-secondary)]">
                                                {c.url ?? c.host ?? '—'}
                                            </Td>
                                            <Td>
                                                <StatusBadge status={c.lastStatus ?? 'unknown'} />
                                            </Td>
                                            <Td align="right">
                                                {uptime !== null ? (
                                                    <div className="ml-auto flex w-32 items-center gap-2">
                                                        <Progress
                                                            value={uptime}
                                                            className="flex-1"
                                                            aria-label={`Uptime ${uptime.toFixed(2)} percent`}
                                                        />
                                                        <span className="w-14 text-right text-[12px] tabular-nums text-[var(--st-text)]">
                                                            {uptime.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        —
                                                    </span>
                                                )}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
