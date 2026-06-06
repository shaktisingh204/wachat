import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeEngagements } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardContent,
    EmptyState,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/sabcrm/20ui/compat';

async function EngagementsData() {
    const list = await listSabpracticeEngagements({ status: 'all', limit: 200 });
    return (
        <div className="space-y-4">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Engagements</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Cross-client engagement list. Open a client to add a new one.
                    </p>
                </div>
            </PageHeader>
            <Card>
                <CardContent className="p-0">
                    {list.items.length === 0 ? (
                        <EmptyState
                            title="No engagements"
                            description="Engagements appear here once you create them from a client cockpit."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Billing</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {list.items.map((e) => (
                                    <TableRow key={e._id}>
                                        <TableCell className="font-medium">{e.name}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {e.clientId.slice(-6)}
                                        </TableCell>
                                        <TableCell>{e.billingCadence ?? '—'}</TableCell>
                                        <TableCell>
                                            {e.hourlyRateMinor
                                                ? `${(e.hourlyRateMinor / 100).toFixed(2)} ${e.currency ?? ''}`
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge>{e.status ?? 'active'}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function EngagementsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
            }
        >
            <EngagementsData />
        </Suspense>
    );
}
