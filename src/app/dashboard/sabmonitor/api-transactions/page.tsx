import * as React from 'react';
import Link from 'next/link';
import { Plus, ListOrdered, Workflow } from 'lucide-react';

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
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { listSabmonitorApiTransactions } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

function stepCount(stepsJson: unknown): number {
    return Array.isArray(stepsJson) ? stepsJson.length : 0;
}

export default async function ApiTransactionsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorApiTransactions();
    const hasItems = res.items.length > 0;
    const totalSteps = res.items.reduce((s, t) => s + stepCount(t.stepsJson), 0);

    return (
        <div className="flex max-w-[1000px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>API transactions</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        className="u-btn u-btn--primary u-btn--md"
                        href="/dashboard/sabmonitor/api-transactions/new"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New transaction</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {hasItems && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard
                        label="Transactions"
                        value={<span className="tabular-nums">{res.items.length}</span>}
                        icon={<ListOrdered aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Total steps"
                        value={<span className="tabular-nums">{totalSteps}</span>}
                        icon={<Workflow aria-hidden="true" />}
                        accent="#7c3aed"
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <ListOrdered
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Multi-step flows
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {hasItems ? (
                        <Table hover>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th align="right">Steps</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((t) => (
                                    <Tr key={t._id}>
                                        <Td>
                                            <Link
                                                className="font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                                href={`/dashboard/sabmonitor/api-transactions/${t._id}`}
                                            >
                                                {t.name}
                                            </Link>
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {stepCount(t.stepsJson)}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={ListOrdered}
                            title="No transactions yet"
                            description="Chain HTTP requests into a multi-step flow to monitor an end-to-end API journey."
                            action={
                                <Link
                                    className="u-btn u-btn--primary u-btn--md"
                                    href="/dashboard/sabmonitor/api-transactions/new"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New transaction</span>
                                </Link>
                            }
                        />
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
