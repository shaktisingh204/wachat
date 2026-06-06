/**
 * `/dashboard/requests/blueprints` — admin view of all blueprints
 * (published + draft).
 */
import * as React from 'react';
import Link from 'next/link';

import { Button, Card, Badge } from '@/components/sabcrm/20ui/compat';
import { listBlueprints } from '@/app/actions/sabrequests.actions';

export const dynamic = 'force-dynamic';

export default async function BlueprintsListPage() {
    const res = await listBlueprints({ limit: 200 });
    const rows = res.data ?? [];
    return (
        <div className="zoruui flex flex-col gap-6 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Blueprints</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Templates that drive form-based approval workflows.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/requests/blueprints/new">
                        New blueprint
                    </Link>
                </Button>
            </header>
            <Card className="divide-y divide-zoru-line p-0">
                {rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-zoru-ink-muted">
                        No blueprints yet.
                    </div>
                ) : (
                    rows.map((b) => (
                        <Link
                            key={b._id}
                            href={`/dashboard/requests/blueprints/${b._id}`}
                            className="flex items-center justify-between gap-4 p-4 transition hover:bg-zoru-surface-2/40"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{b.name}</span>
                                    {b.published ? (
                                        <Badge variant="success">Published</Badge>
                                    ) : (
                                        <Badge variant="secondary">Draft</Badge>
                                    )}
                                </div>
                                <div className="text-xs text-zoru-ink-muted">
                                    {b.category ?? '—'} · {b.stages?.length ?? 0}{' '}
                                    stages
                                </div>
                            </div>
                            <div className="text-right text-xs text-zoru-ink-muted">
                                {b.slaMins ? `${b.slaMins} min SLA` : 'no SLA'}
                            </div>
                        </Link>
                    ))
                )}
            </Card>
        </div>
    );
}
