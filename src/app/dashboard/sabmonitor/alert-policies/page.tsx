import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent } from '@/components/sabcrm/20ui/compat';

import { listSabmonitorAlertPolicies } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function AlertPoliciesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorAlertPolicies();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">Alert policies</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/alert-policies/new">New policy</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No alert policies yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-line">
                            {res.items.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between p-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <Link
                                            className="text-sm font-medium text-zoru-ink hover:underline"
                                            href={`/dashboard/sabmonitor/alert-policies/${p._id}`}
                                        >
                                            {p.name}
                                        </Link>
                                        <span className="text-[12px] text-zoru-ink-muted">
                                            {(p.channels ?? []).length} channels ·{' '}
                                            {(p.checkIds ?? []).length} checks
                                        </span>
                                    </div>
                                    <StatusBadge status={p.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
