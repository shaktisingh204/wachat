import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeDeadlines } from '@/app/actions/sabpractice.actions';
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

import { FileDeadlineButton } from './_components/file-deadline-button';

async function DeadlinesData() {
    const list = await listSabpracticeDeadlines({ status: 'all', limit: 500 });

    // Group by kind for a calendar-ish view (we don't have a ZoruUI calendar
    // primitive for arbitrary event lists in scope; use a sorted table).
    const sorted = [...list.items].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return (
        <div className="space-y-4">
            <PageHeader>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Deadlines</h1>
                    <p className="text-sm text-[var(--zoru-ink-muted)]">
                        Compliance calendar — soonest first.
                    </p>
                </div>
            </PageHeader>

            <Card>
                <CardContent className="p-0">
                    {sorted.length === 0 ? (
                        <EmptyState
                            title="No deadlines"
                            description="Add a deadline from any client cockpit."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Due</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Kind</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.map((d) => {
                                    const due = new Date(d.dueDate);
                                    const overdue =
                                        d.status !== 'filed' && due.getTime() < Date.now();
                                    return (
                                        <TableRow key={d._id}>
                                            <TableCell className="font-medium">
                                                {due.toLocaleDateString()}
                                            </TableCell>
                                            <TableCell>{d.name}</TableCell>
                                            <TableCell>{d.kind ?? 'custom'}</TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {d.clientId.slice(-6)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge>
                                                    {overdue ? 'overdue' : d.status ?? 'upcoming'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {d.status !== 'filed' ? (
                                                    <FileDeadlineButton id={d._id!} />
                                                ) : null}
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

export default function DeadlinesPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--zoru-ink-muted)]">Loading…</div>
            }
        >
            <DeadlinesData />
        </Suspense>
    );
}
