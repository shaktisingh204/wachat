import * as React from 'react';
import Link from 'next/link';
import { Plus, Activity } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { listSabmonitorApiTransactions } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

export default async function ApiTransactionsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorApiTransactions();
    const hasItems = res.items.length > 0;

    return (
        <div className="ui20 flex flex-col gap-4">
            <PageHeader>
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

            <Card padding="none">
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
                                                className="font-medium text-[var(--st-text)] hover:underline"
                                                href={`/dashboard/sabmonitor/api-transactions/${t._id}`}
                                            >
                                                {t.name}
                                            </Link>
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {Array.isArray(t.stepsJson)
                                                ? `${(t.stepsJson as unknown[]).length} steps`
                                                : '-'}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    ) : (
                        <EmptyState
                            icon={Activity}
                            title="No transactions yet"
                            description="API transactions you create will show up here."
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
