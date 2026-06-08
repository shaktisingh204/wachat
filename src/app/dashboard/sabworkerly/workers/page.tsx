import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Badge,
    type BadgeTone,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Users, UserCheck, UserMinus } from 'lucide-react';
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

    const onAssignment = workers.filter((w) => w.status === 'on_assignment').length;
    const available = workers.filter((w) => w.status === 'active').length;

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Workers</PageTitle>
                    <PageDescription>
                        Your temp workforce — skills, pay rates, and who is free to place.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" asChild>
                        <Link href="/dashboard/sabworkerly/workers/new">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add worker
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {workers.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No workers yet"
                    description="Add your first temp worker to start placing them into client jobs."
                    action={
                        <Button variant="primary" asChild>
                            <Link href="/dashboard/sabworkerly/workers/new">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add worker
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <section
                        aria-label="Worker totals"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                    >
                        <StatCard
                            icon={Users}
                            accent="#1f9d55"
                            label="Total workers"
                            value={<span className="tabular-nums">{workers.length}</span>}
                        />
                        <StatCard
                            icon={UserCheck}
                            accent="#3b7af5"
                            label="On assignment"
                            value={<span className="tabular-nums">{onAssignment}</span>}
                        />
                        <StatCard
                            icon={UserMinus}
                            label="Available now"
                            value={<span className="tabular-nums">{available}</span>}
                        />
                    </section>

                    <Card padding="none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users
                                    className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                All workers
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Name</Th>
                                        <Th>Email</Th>
                                        <Th>Skills</Th>
                                        <Th align="right">Rate</Th>
                                        <Th>Status</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {workers.map((w) => (
                                        <Tr key={w._id}>
                                            <Td>
                                                <Link
                                                    href={`/dashboard/sabworkerly/workers/${w._id}`}
                                                    className="font-medium text-[color:var(--st-text)] hover:underline focus-visible:underline focus-visible:outline-none"
                                                >
                                                    {w.name}
                                                </Link>
                                            </Td>
                                            <Td className="text-[color:var(--st-text-secondary)]">
                                                {w.email}
                                            </Td>
                                            <Td>
                                                <div className="flex flex-wrap gap-1">
                                                    {(w.skills ?? []).slice(0, 3).map((s) => (
                                                        <Badge key={s} tone="neutral" kind="soft">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                    {(w.skills ?? []).length > 3 && (
                                                        <Badge tone="neutral" kind="outline">
                                                            +{(w.skills ?? []).length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {money(w.hourlyRateMinor, w.currency)}/h
                                            </Td>
                                            <Td>
                                                <Badge tone={STATUS_TONE[w.status] ?? 'neutral'} dot>
                                                    {STATUS_LABEL[w.status] ?? w.status}
                                                </Badge>
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
