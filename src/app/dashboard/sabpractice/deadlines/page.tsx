import * as React from 'react';
import { Suspense } from 'react';
import { CalendarClock } from 'lucide-react';

import { listSabpracticeDeadlines } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    type BadgeTone,
    Card,
    CardBody,
    EmptyState,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { FileDeadlineButton } from './_components/file-deadline-button';

/** Map a deadline status to a Badge tone so colour carries meaning. */
function statusTone(status: string): BadgeTone {
    if (status === 'overdue') return 'danger';
    if (status === 'filed') return 'success';
    if (status === 'upcoming') return 'info';
    return 'neutral';
}

async function DeadlinesData() {
    const list = await listSabpracticeDeadlines({ status: 'all', limit: 500 });

    // Group by kind for a calendar-ish view. There is no 20ui calendar primitive
    // for arbitrary event lists in scope, so we use a sorted table (soonest first).
    const sorted = [...list.items].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return (
        <div className="space-y-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Deadlines</PageTitle>
                    <PageDescription>Compliance calendar, soonest first.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card>
                <CardBody className="p-0">
                    {sorted.length === 0 ? (
                        <EmptyState
                            icon={CalendarClock}
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
                                    <Th align="right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {sorted.map((d) => {
                                    const due = new Date(d.dueDate);
                                    const overdue =
                                        d.status !== 'filed' && due.getTime() < Date.now();
                                    const status = overdue ? 'overdue' : d.status ?? 'upcoming';
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
                                                <Badge tone={statusTone(status)}>{status}</Badge>
                                            </Td>
                                            <Td align="right">
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
                </CardBody>
            </Card>
        </div>
    );
}

export default function DeadlinesPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading.</div>
            }
        >
            <DeadlinesData />
        </Suspense>
    );
}
