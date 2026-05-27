import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent } from '@/components/zoruui';

import { listSabmonitorStatusPages } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function StatusPagesIndex(): Promise<React.JSX.Element> {
    const res = await listSabmonitorStatusPages();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">Status pages</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/status-pages/new">New status page</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No status pages.</p>
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
                                            href={`/dashboard/sabmonitor/status-pages/${p._id}`}
                                        >
                                            {p.title}
                                        </Link>
                                        <span className="text-[12px] text-zoru-ink-muted">
                                            Public URL:{' '}
                                            <Link
                                                className="text-zoru-brand hover:underline"
                                                href={`/status/${p.slug}`}
                                            >
                                                /status/{p.slug}
                                            </Link>
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
