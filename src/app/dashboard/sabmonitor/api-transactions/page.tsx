import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent } from '@/components/zoruui';

import { listSabmonitorApiTransactions } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

export default async function ApiTransactionsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorApiTransactions();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">API transactions</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/api-transactions/new">New transaction</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No transactions yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-line">
                            {res.items.map((t) => (
                                <li key={t._id} className="flex items-center justify-between p-3">
                                    <Link
                                        className="text-sm font-medium text-zoru-ink hover:underline"
                                        href={`/dashboard/sabmonitor/api-transactions/${t._id}`}
                                    >
                                        {t.name}
                                    </Link>
                                    <span className="text-[12px] text-zoru-ink-muted">
                                        {Array.isArray(t.stepsJson) ? `${(t.stepsJson as unknown[]).length} steps` : '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
