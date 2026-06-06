import React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody, PageHeader, PageTitle, PageActions, Badge, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
import { Plus, Building2 } from 'lucide-react';
import { getSabworkerlyClients } from '@/app/actions/sabworkerly.actions';

export default async function ClientsListPage() {
    const clients = await getSabworkerlyClients({ status: 'all', limit: 200 });
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <PageTitle>Clients</PageTitle>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/clients/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add client
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            {clients.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="No clients yet"
                    description="Add the businesses that book temp workers from your agency."
                    actionLabel="Add client"
                    actionHref="/dashboard/sabworkerly/clients/new"
                />
            ) : (
                <Card>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Business</Th>
                                    <Th>Contact</Th>
                                    <Th>Email</Th>
                                    <Th>Terms</Th>
                                    <Th>Status</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {clients.map((c) => (
                                    <Tr key={c._id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabworkerly/clients/${c._id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                        </Td>
                                        <Td>{c.contactName ?? '—'}</Td>
                                        <Td className="text-[color:var(--st-text-secondary)]">
                                            {c.contactEmail ?? '—'}
                                        </Td>
                                        <Td>NET-{c.paymentTermsDays}</Td>
                                        <Td>
                                            <Badge variant={c.status === 'active' ? 'default' : 'outline'}>
                                                {c.status}
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
