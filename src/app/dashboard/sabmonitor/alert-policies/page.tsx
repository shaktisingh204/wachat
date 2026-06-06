import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody } from '@/components/sabcrm/20ui';

import { listSabmonitorAlertPolicies } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function AlertPoliciesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorAlertPolicies();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Alert policies</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/alert-policies/new">New policy</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-[var(--st-text-secondary)]">No alert policies yet.</p>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {res.items.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between p-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <Link
                                            className="text-sm font-medium text-[var(--st-text)] hover:underline"
                                            href={`/dashboard/sabmonitor/alert-policies/${p._id}`}
                                        >
                                            {p.name}
                                        </Link>
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                                            {(p.channels ?? []).length} channels ·{' '}
                                            {(p.checkIds ?? []).length} checks
                                        </span>
                                    </div>
                                    <StatusBadge status={p.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
