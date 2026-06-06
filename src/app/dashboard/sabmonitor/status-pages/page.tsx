import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody } from '@/components/sabcrm/20ui';

import { listSabmonitorStatusPages } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function StatusPagesIndex(): Promise<React.JSX.Element> {
    const res = await listSabmonitorStatusPages();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Status pages</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/status-pages/new">New status page</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-[var(--st-text-secondary)]">No status pages.</p>
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
                                            href={`/dashboard/sabmonitor/status-pages/${p._id}`}
                                        >
                                            {p.title}
                                        </Link>
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                                            Public URL:{' '}
                                            <Link
                                                className="text-[var(--st-accent)] hover:underline"
                                                href={`/uptime/${p.slug}`}
                                            >
                                                /uptime/{p.slug}
                                            </Link>
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
