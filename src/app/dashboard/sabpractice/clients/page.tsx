import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Building2, CircleDot, Sprout, Users } from 'lucide-react';

import { listSabpracticeClients } from '@/app/actions/sabpractice.actions';
import {
    Avatar,
    Badge,
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Skeleton,
    StatCard,
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

function statusLabel(status?: string): string {
    const s = status ?? 'active';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

async function ClientsData() {
    const clients = await listSabpracticeClients({ status: 'all', limit: 100 });
    const items = clients.items;
    const active = items.filter((c) => c.status === 'active').length;
    const onboarding = items.filter((c) => c.status === 'onboarding').length;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabPractice</PageEyebrow>
                    <PageTitle>Clients</PageTitle>
                    <PageDescription>
                        The business entities whose books and advisory work you manage.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <ClientCreateDialog />
                </PageActions>
            </PageHeader>

            {items.length > 0 ? (
                <section
                    aria-label="Client metrics"
                    className="grid gap-4 sm:grid-cols-3"
                >
                    <StatCard
                        label="Total clients"
                        value={String(items.length)}
                        icon={Users}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Active"
                        value={String(active)}
                        icon={CircleDot}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Onboarding"
                        value={String(onboarding)}
                        icon={Sprout}
                        accent="#7c3aed"
                    />
                </section>
            ) : null}

            <Card padding="none">
                <CardBody className="p-0">
                    {items.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No clients yet"
                            description="Add your first client business to start tracking engagements, deadlines, and time."
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
                                {items.map((c) => (
                                    <Tr key={c._id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabpractice/clients/${c._id}`}
                                                className="inline-flex items-center gap-2.5 font-medium text-[var(--st-text)] underline-offset-2 hover:underline"
                                            >
                                                <Avatar
                                                    name={c.name}
                                                    shape="square"
                                                    size="sm"
                                                />
                                                {c.name}
                                            </Link>
                                        </Td>
                                        <Td className="text-sm text-[var(--st-text-secondary)]">
                                            {c.industry ?? 'Not set'}
                                        </Td>
                                        <Td className="text-sm">
                                            {c.primaryContactName ?? 'Not set'}
                                            {c.primaryContactEmail ? (
                                                <span className="block text-xs text-[var(--st-text-secondary)]">
                                                    {c.primaryContactEmail}
                                                </span>
                                            ) : null}
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(c.status)}>
                                                {statusLabel(c.status)}
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

function ClientsSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading clients">
            <div className="space-y-2">
                <Skeleton width={90} height={12} />
                <Skeleton width={160} height={26} />
                <Skeleton width={380} height={14} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} height={92} />
                ))}
            </div>
            <Skeleton height={280} />
        </div>
    );
}

export default function SabpracticeClientsPage() {
    return (
        <Suspense fallback={<ClientsSkeleton />}>
            <ClientsData />
        </Suspense>
    );
}
