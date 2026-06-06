import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody } from '@/components/sabcrm/20ui';

import { listSabmonitorApiTransactions } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

export default async function ApiTransactionsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorApiTransactions();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">API transactions</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/api-transactions/new">New transaction</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-[var(--st-text-secondary)]">No transactions yet.</p>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {res.items.map((t) => (
                                <li key={t._id} className="flex items-center justify-between p-3">
                                    <Link
                                        className="text-sm font-medium text-[var(--st-text)] hover:underline"
                                        href={`/dashboard/sabmonitor/api-transactions/${t._id}`}
                                    >
                                        {t.name}
                                    </Link>
                                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                                        {Array.isArray(t.stepsJson) ? `${(t.stepsJson as unknown[]).length} steps` : '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
