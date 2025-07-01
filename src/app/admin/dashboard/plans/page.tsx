

import { getPlans } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Edit, PlusCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { AdminDeletePlanButton } from '@/components/wabasimplify/admin-delete-plan-button';

export const dynamic = 'force-dynamic';

export default async function PlansManagementPage() {
    const plans = await getPlans();

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Subscription Plans</h1>
                    <p className="text-muted-foreground">Create and manage subscription plans for your users.</p>
                </div>
                <Button asChild>
                    <Link href="/admin/dashboard/plans/new">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Plan
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Existing Plans</CardTitle>
                    <CardDescription>A list of all configurable plans in the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Plan Name</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Projects</TableHead>
                                    <TableHead>Agents</TableHead>
                                    <TableHead>Templates</TableHead>
                                    <TableHead>Flows</TableHead>
                                    <TableHead>Public</TableHead>
                                    <TableHead>Default</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plans.length > 0 ? (
                                    plans.map((plan) => (
                                        <TableRow key={plan._id.toString()}>
                                            <TableCell className="font-medium">{plan.name}</TableCell>
                                            <TableCell>{plan.currency} {plan.price}/month</TableCell>
                                            <TableCell>{plan.projectLimit}</TableCell>
                                            <TableCell>{plan.agentLimit}</TableCell>
                                            <TableCell>{plan.templateLimit}</TableCell>
                                            <TableCell>{plan.flowLimit}</TableCell>
                                            <TableCell>{plan.isPublic ? <CheckCircle className="text-primary"/> : <XCircle className="text-muted"/>}</TableCell>
                                            <TableCell>{plan.isDefault ? <CheckCircle className="text-primary"/> : <XCircle className="text-muted"/>}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button asChild variant="ghost" size="icon">
                                                        <Link href={`/admin/dashboard/plans/${plan._id.toString()}`}><Edit className="h-4 w-4" /></Link>
                                                    </Button>
                                                    <AdminDeletePlanButton planId={plan._id.toString()} planName={plan.name} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center">
                                            No plans found. Create one to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
