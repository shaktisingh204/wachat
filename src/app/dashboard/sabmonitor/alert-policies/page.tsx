import * as React from 'react';
import Link from 'next/link';
import { BellRing, Plus, Bell, Radio, Pause } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Separator,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

import { listSabmonitorAlertPolicies } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function AlertPoliciesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorAlertPolicies();
    const total = res.items.length;
    const active = res.items.filter((p) => p.status === 'active').length;

    return (
        <div className="flex max-w-[1100px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Alert policies</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/alert-policies/new"
                        className="u-btn u-btn--primary u-btn--md"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New policy</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {total > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Policies"
                        value={<span className="tabular-nums">{total}</span>}
                        icon={<Bell aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Active"
                        value={<span className="tabular-nums">{active}</span>}
                        icon={<Radio aria-hidden="true" />}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Paused"
                        value={<span className="tabular-nums">{total - active}</span>}
                        icon={<Pause aria-hidden="true" />}
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <BellRing
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Routing rules
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={BellRing}
                            title="No alert policies yet"
                            description="Create a policy to route monitor failures to email, Slack, or webhooks."
                            action={
                                <Link
                                    href="/dashboard/sabmonitor/alert-policies/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New policy</span>
                                </Link>
                            }
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th align="right">Channels</Th>
                                    <Th align="right">Monitors</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((p) => (
                                    <Tr key={p._id}>
                                        <Td>
                                            <Link
                                                className="font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                                href={`/dashboard/sabmonitor/alert-policies/${p._id}`}
                                            >
                                                {p.name}
                                            </Link>
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {(p.channels ?? []).length}
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {(p.checkIds ?? []).length || 'All'}
                                        </Td>
                                        <Td>
                                            <StatusBadge status={p.status} />
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
