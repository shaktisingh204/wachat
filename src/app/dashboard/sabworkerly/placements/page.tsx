import React from 'react';

import {
    Card,
    CardContent,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
    Badge,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    EmptyState,
} from '@/components/zoruui';
import { UserCheck } from 'lucide-react';
import { getSabworkerlyPlacements } from '@/app/actions/sabworkerly.actions';

function money(minor: number, currency = 'USD'): string {
    const major = (minor || 0) / 100;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major);
    } catch {
        return `$${major.toFixed(2)}`;
    }
}

export default async function PlacementsPage() {
    const placements = await getSabworkerlyPlacements({ status: 'active', limit: 200 });
    return (
        <div className="zoruui flex flex-col gap-5">
            <PageHeader>
                <ZoruPageTitle>Active placements</ZoruPageTitle>
                <ZoruPageDescription>
                    Workers currently on assignment. Margin = charge − pay.
                </ZoruPageDescription>
            </PageHeader>

            {placements.length === 0 ? (
                <EmptyState
                    icon={UserCheck}
                    title="No active placements"
                    description="Place a worker into a job from the Jobs view."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Worker</TableHead>
                                    <TableHead>Job</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>Charge / Pay</TableHead>
                                    <TableHead>Margin / h</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {placements.map((p) => (
                                    <TableRow key={p._id}>
                                        <TableCell className="font-mono text-xs">{p.workerId}</TableCell>
                                        <TableCell className="font-mono text-xs">{p.jobId}</TableCell>
                                        <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {money(p.hourlyChargeRateMinor)} / {money(p.hourlyPayRateMinor)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {money(p.hourlyChargeRateMinor - p.hourlyPayRateMinor)}
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
