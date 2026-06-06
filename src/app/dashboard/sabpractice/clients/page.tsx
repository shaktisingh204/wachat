import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';

import { listSabpracticeClients } from '@/app/actions/sabpractice.actions';
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

import { ClientCreateDialog } from './_components/client-create-dialog';

async function ClientsData({ status }: { status?: string }) {
    const clients = await listSabpracticeClients({ status: status ?? 'all', limit: 100 });

    return (
        <div className="space-y-4">
            <PageHeader>
                <div className="flex w-full items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            Business entities whose books you manage.
                        </p>
                    </div>
                    <ClientCreateDialog />
                </div>
            </PageHeader>

            <Card>
                <CardBody className="p-0">
                    {clients.items.length === 0 ? (
                        <EmptyState
                            title="No clients yet"
                            description="Add your first client business to start managing engagements."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Industry</Th>
                                    <Th>Primary contact</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {clients.items.map((c) => (
                                    <Tr key={c._id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabpractice/clients/${c._id}`}
                                                className="font-medium underline-offset-2 hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                        </Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">
                                            {c.industry ?? '—'}
                                        </Td>
                                        <Td className="text-sm">
                                            {c.primaryContactName ?? '—'}
                                            {c.primaryContactEmail ? (
                                                <span className="block text-xs text-[var(--st-text-secondary)]">
                                                    {c.primaryContactEmail}
                                                </span>
                                            ) : null}
                                        </Td>
                                        <Td>
                                            <Badge>{c.status ?? 'active'}</Badge>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

export default function SabpracticeClientsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading clients…</div>
            }
        >
            <ClientsData />
        </Suspense>
    );
}
