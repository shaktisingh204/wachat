import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageActions,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    EmptyState,
} from '@/components/zoruui';
import { Plus, Building2 } from 'lucide-react';
import { getSabworkerlyClients } from '@/app/actions/sabworkerly.actions';

export default async function ClientsListPage() {
    const clients = await getSabworkerlyClients({ status: 'all', limit: 200 });
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Clients</ZoruPageTitle>
                <ZoruPageActions>
                    <Link href="/dashboard/sabworkerly/clients/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add client
                        </Button>
                    </Link>
                </ZoruPageActions>
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
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Business</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Terms</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.map((c) => (
                                    <TableRow key={c._id}>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/sabworkerly/clients/${c._id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{c.contactName ?? '—'}</TableCell>
                                        <TableCell className="text-[color:var(--zoru-muted-fg)]">
                                            {c.contactEmail ?? '—'}
                                        </TableCell>
                                        <TableCell>NET-{c.paymentTermsDays}</TableCell>
                                        <TableCell>
                                            <Badge variant={c.status === 'active' ? 'default' : 'outline'}>
                                                {c.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
