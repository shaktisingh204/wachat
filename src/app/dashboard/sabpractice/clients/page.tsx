import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Building2 } from 'lucide-react';

import { listSabpracticeClients } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
    Spinner,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

import { ClientCreateDialog } from './_components/client-create-dialog';

/** Map a client status to a Badge tone so colour always carries meaning. */
function statusTone(status?: string): BadgeTone {
    switch (status) {
        case 'active':
            return 'success';
        case 'onboarding':
            return 'info';
        case 'inactive':
            return 'neutral';
        default:
            return 'neutral';
    }
}

async function ClientsData({ status }: { status?: string }) {
    const clients = await listSabpracticeClients({ status: status ?? 'all', limit: 100 });

    return (
        <div className="space-y-4">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Clients</PageTitle>
                    <PageDescription>Business entities whose books you manage.</PageDescription>
                </PageHeading>
                <PageActions>
                    <ClientCreateDialog />
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody className="p-0">
                    {clients.items.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No clients yet"
                            description="Add your first client business to start managing engagements."
                            action={<ClientCreateDialog />}
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
                                            {c.industry ?? '-'}
                                        </Td>
                                        <Td className="text-sm">
                                            {c.primaryContactName ?? '-'}
                                            {c.primaryContactEmail ? (
                                                <span className="block text-xs text-[var(--st-text-secondary)]">
                                                    {c.primaryContactEmail}
                                                </span>
                                            ) : null}
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(c.status)}>
                                                {c.status ?? 'active'}
                                            </Badge>
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
                <div className="flex items-center gap-2 p-6 text-sm text-[var(--st-text-secondary)]">
                    <Spinner size="sm" label="Loading clients" />
                    <span>Loading clients.</span>
                </div>
            }
        >
            <ClientsData />
        </Suspense>
    );
}
