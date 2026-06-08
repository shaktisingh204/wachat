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
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { Plus, Building2, CheckCircle2 } from 'lucide-react';
import { getSabworkerlyClients } from '@/app/actions/sabworkerly.actions';

export default async function ClientsListPage() {
    const clients = await getSabworkerlyClients({ status: 'all', limit: 200 });
    const activeCount = clients.filter((c) => c.status === 'active').length;

    return (
        <div className="20ui mx-auto flex w-full max-w-[1200px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabWorkerly</PageEyebrow>
                    <PageTitle>Clients</PageTitle>
                    <PageDescription>
                        Businesses that book temp workers from your agency.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="primary" asChild>
                        <Link href="/dashboard/sabworkerly/clients/new">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add client
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {clients.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="No clients yet"
                    description="Add the businesses that book temp workers from your agency."
                    action={
                        <Button variant="primary" asChild>
                            <Link href="/dashboard/sabworkerly/clients/new">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add client
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <>
                    <section
                        aria-label="Client totals"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                        <StatCard
                            icon={Building2}
                            accent="#3b7af5"
                            label="Total clients"
                            value={<span className="tabular-nums">{clients.length}</span>}
                        />
                        <StatCard
                            icon={CheckCircle2}
                            accent="#1f9d55"
                            label="Active accounts"
                            value={<span className="tabular-nums">{activeCount}</span>}
                        />
                    </section>

                    <Card padding="none">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2
                                    className="h-4 w-4 text-[color:var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                All clients
                            </CardTitle>
                        </CardHeader>
                        <CardBody className="p-0">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Business</Th>
                                        <Th>Contact</Th>
                                        <Th>Email</Th>
                                        <Th align="right">Terms</Th>
                                        <Th>Status</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {clients.map((c) => (
                                        <Tr key={c._id}>
                                            <Td>
                                                <Link
                                                    href={`/dashboard/sabworkerly/clients/${c._id}`}
                                                    className="font-medium text-[color:var(--st-text)] hover:underline focus-visible:underline focus-visible:outline-none"
                                                >
                                                    {c.name}
                                                </Link>
                                            </Td>
                                            <Td>{c.contactName ?? '—'}</Td>
                                            <Td className="text-[color:var(--st-text-secondary)]">
                                                {c.contactEmail ?? '—'}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                NET-{c.paymentTermsDays}
                                            </Td>
                                            <Td>
                                                <Badge
                                                    tone={c.status === 'active' ? 'success' : 'neutral'}
                                                    kind={c.status === 'active' ? 'soft' : 'outline'}
                                                    dot
                                                >
                                                    {c.status === 'active' ? 'Active' : 'Inactive'}
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
