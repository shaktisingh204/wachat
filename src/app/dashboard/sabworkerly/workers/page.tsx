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
} from '@/components/sabcrm/20ui/compat';
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
                <ZoruPageTitle>Workers</ZoruPageTitle>
                <ZoruPageActions>
                    <Link href="/dashboard/sabworkerly/workers/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add worker
                        </Button>
                    </Link>
                </ZoruPageActions>
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
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Skills</TableHead>
                                    <TableHead>Rate</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {workers.map((w) => (
                                    <TableRow key={w._id}>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/sabworkerly/workers/${w._id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {w.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-[color:var(--zoru-muted-fg)]">
                                            {w.email}
                                        </TableCell>
                                        <TableCell>
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
                                        </TableCell>
                                        <TableCell>{money(w.hourlyRateMinor, w.currency)}/h</TableCell>
                                        <TableCell>
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
