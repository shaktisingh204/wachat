import * as React from 'react';
import Link from 'next/link';
import { Suspense } from 'react';

import { listSabpracticeClients } from '@/app/actions/sabpractice.actions';
import {
    Badge,
    Card,
    CardContent,
    EmptyState,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/sabcrm/20ui/compat';

import { ClientCreateDialog } from './_components/client-create-dialog';

async function ClientsData({ status }: { status?: string }) {
    const clients = await listSabpracticeClients({ status: status ?? 'all', limit: 100 });

    return (
        <div className="space-y-4">
            <PageHeader>
                <div className="flex w-full items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
                        <p className="text-sm text-[var(--zoru-ink-muted)]">
                            Business entities whose books you manage.
                        </p>
                    </div>
                    <ClientCreateDialog />
                </div>
            </PageHeader>

            <Card>
                <CardContent className="p-0">
                    {clients.items.length === 0 ? (
                        <EmptyState
                            title="No clients yet"
                            description="Add your first client business to start managing engagements."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Industry</TableHead>
                                    <TableHead>Primary contact</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.items.map((c) => (
                                    <TableRow key={c._id}>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/sabpractice/clients/${c._id}`}
                                                className="font-medium underline-offset-2 hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-sm text-[var(--zoru-ink-muted)]">
                                            {c.industry ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {c.primaryContactName ?? '—'}
                                            {c.primaryContactEmail ? (
                                                <span className="block text-xs text-[var(--zoru-ink-muted)]">
                                                    {c.primaryContactEmail}
                                                </span>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            <Badge>{c.status ?? 'active'}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function SabpracticeClientsPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-[var(--zoru-ink-muted)]">Loading clients…</div>
            }
        >
            <ClientsData />
        </Suspense>
    );
}
