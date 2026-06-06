import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Building2 } from 'lucide-react';
import { getSabworkerlyClients } from '@/app/actions/sabworkerly.actions';

export default async function ClientsListPage() {
    const clients = await getSabworkerlyClients({ status: 'all', limit: 200 });
    return (
        <div className="flex flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Clients</PageTitle>
                    <PageDescription>
                        Businesses that book temp workers from your agency.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabworkerly/clients/new">
                        <Button variant="primary" iconLeft={Plus}>
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
                    action={
                        <Link href="/dashboard/sabworkerly/clients/new">
                            <Button variant="primary" iconLeft={Plus}>
                                Add client
                            </Button>
                        </Link>
                    }
                />
            ) : (
                <Card padding="none">
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
                                        <Td>{c.contactName ?? '-'}</Td>
                                        <Td className="text-[color:var(--st-text-secondary)]">
                                            {c.contactEmail ?? '-'}
                                        </Td>
                                        <Td>NET-{c.paymentTermsDays}</Td>
                                        <Td>
                                            <Badge tone={c.status === 'active' ? 'success' : 'neutral'} kind={c.status === 'active' ? 'soft' : 'outline'}>
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
