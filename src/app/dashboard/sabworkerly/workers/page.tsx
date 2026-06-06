import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Badge,
    type BadgeTone,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Users } from 'lucide-react';
import { getSabworkerlyWorkers } from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

const STATUS_TONE: Record<string, BadgeTone> = {
    active: 'success',
    on_assignment: 'info',
    inactive: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
    active: 'Active',
    on_assignment: 'On assignment',
    inactive: 'Inactive',
};

export default async function WorkersListPage() {
    const workers = await getSabworkerlyWorkers({ status: 'all', limit: 200 });
    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Workers</PageTitle>
                    <PageDescription>
                        Manage your temp workers and place them into client jobs.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/workers/new">
                        <Button variant="primary" iconLeft={Plus}>
                            Add worker
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            {workers.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No workers yet"
                    description="Add your first temp worker to start placing them into client jobs."
                    action={
                        <Link href="/dashboard/sabworkerly/workers/new">
                            <Button variant="primary" iconLeft={Plus}>
                                Add worker
                            </Button>
                        </Link>
                    }
                />
            ) : (
                <Card padding="none">
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Email</Th>
                                <Th>Skills</Th>
                                <Th>Rate</Th>
                                <Th>Status</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {workers.map((w) => (
                                <Tr key={w._id}>
                                    <Td>
                                        <Link
                                            href={`/dashboard/sabworkerly/workers/${w._id}`}
                                            className="font-medium text-[var(--st-text)] hover:underline"
                                        >
                                            {w.name}
                                        </Link>
                                    </Td>
                                    <Td className="text-[var(--st-text-secondary)]">
                                        {w.email}
                                    </Td>
                                    <Td>
                                        <div className="flex flex-wrap gap-1">
                                            {(w.skills ?? []).slice(0, 3).map((s) => (
                                                <Badge key={s} tone="neutral">{s}</Badge>
                                            ))}
                                            {(w.skills ?? []).length > 3 && (
                                                <Badge tone="neutral" kind="outline">
                                                    +{(w.skills ?? []).length - 3}
                                                </Badge>
                                            )}
                                        </div>
                                    </Td>
                                    <Td>{money(w.hourlyRateMinor, w.currency)}/h</Td>
                                    <Td>
                                        <Badge tone={STATUS_TONE[w.status] ?? 'neutral'} dot>
                                            {STATUS_LABEL[w.status] ?? w.status}
                                        </Badge>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
