import React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody, PageHeader, PageTitle, PageActions, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
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

export default async function WorkersListPage() {
    const workers = await getSabworkerlyWorkers({ status: 'all', limit: 200 });
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Workers</PageTitle>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/workers/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
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
                    actionLabel="Add worker"
                    actionHref="/dashboard/sabworkerly/workers/new"
                />
            ) : (
                <Card>
                    <CardBody className="p-0">
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
                                                className="font-medium hover:underline"
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
                                                    <Badge key={s} variant="secondary">{s}</Badge>
                                                ))}
                                                {(w.skills ?? []).length > 3 && (
                                                    <Badge variant="outline">
                                                        +{(w.skills ?? []).length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </Td>
                                        <Td>{money(w.hourlyRateMinor, w.currency)}/h</Td>
                                        <Td>
                                            <Badge
                                                variant={
                                                    w.status === 'active'
                                                        ? 'default'
                                                        : w.status === 'on_assignment'
                                                          ? 'secondary'
                                                          : 'outline'
                                                }
                                            >
                                                {w.status}
                                            </Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
