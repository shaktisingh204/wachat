import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';

import { listSabpracticeDocumentRequests } from '@/app/actions/sabpractice.actions';
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

async function DocRequestsData() {
    const list = await listSabpracticeDocumentRequests({ status: 'open', limit: 200 });

    return (
        <div className="space-y-4">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Document requests</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Open requests across all clients. Files source from SabFiles only.
                    </p>
                </div>
            </PageHeader>

            <Card>
                <CardContent className="p-0">
                    {list.items.length === 0 ? (
                        <EmptyState
                            title="Nothing pending"
                            description="All document requests are complete — nice."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Slots</TableHead>
                                    <TableHead>Due</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {list.items.map((r) => {
                                    const filled = (r.requestedFiles ?? []).filter(
                                        (f) => f.status === 'uploaded' || f.status === 'approved',
                                    ).length;
                                    return (
                                        <TableRow key={r._id}>
                                            <TableCell className="font-medium">{r.title}</TableCell>
                                            <TableCell>
                                                <Link
                                                    className="font-mono text-xs underline-offset-2 hover:underline"
                                                    href={`/dashboard/sabpractice/clients/${r.clientId}`}
                                                >
                                                    {r.clientId.slice(-6)}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {filled}/{(r.requestedFiles ?? []).length}
                                            </TableCell>
                                            <TableCell>
                                                {r.dueDate
                                                    ? new Date(r.dueDate).toLocaleDateString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge>{r.status ?? 'requested'}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function DocRequestsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
            }
        >
            <DocRequestsData />
        </Suspense>
    );
}
