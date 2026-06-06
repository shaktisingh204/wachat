import * as React from 'react';
import { Suspense } from 'react';

import { listSabpracticeDeadlines } from '@/app/actions/sabpractice.actions';
import { Badge, Card, CardContent, EmptyState, PageHeader, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';

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
                    <p className="text-sm text-[var(--st-text-secondary)]">
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
                            <THead>
                                <Tr>
                                    <Th>Due</Th>
                                    <Th>Name</Th>
                                    <Th>Kind</Th>
                                    <Th>Client</Th>
                                    <Th>Status</Th>
                                    <Th className="text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {sorted.map((d) => {
                                    const due = new Date(d.dueDate);
                                    const overdue =
                                        d.status !== 'filed' && due.getTime() < Date.now();
                                    return (
                                        <Tr key={d._id}>
                                            <Td className="font-medium">
                                                {due.toLocaleDateString()}
                                            </Td>
                                            <Td>{d.name}</Td>
                                            <Td>{d.kind ?? 'custom'}</Td>
                                            <Td className="font-mono text-xs">
                                                {d.clientId.slice(-6)}
                                            </Td>
                                            <Td>
                                                <Badge>
                                                    {overdue ? 'overdue' : d.status ?? 'upcoming'}
                                                </Badge>
                                            </Td>
                                            <Td className="text-right">
                                                {d.status !== 'filed' ? (
                                                    <FileDeadlineButton id={d._id!} />
                                                ) : null}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
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
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
            }
        >
            <DeadlinesData />
        </Suspense>
    );
}
