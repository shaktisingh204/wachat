
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getTransactionsForProject, getProjectById } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, IndianRupee, CheckCircle, XCircle } from 'lucide-react';
import { WaPayIcon } from '@/components/wabasimplify/custom-sidebar-components';
import type { Transaction, Project } from '@/lib/definitions';
import { format } from 'date-fns';

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const getStatusVariant = (status: Transaction['status']) => {
    switch (status) {
        case 'SUCCESS': return 'default';
        case 'FAILED': return 'destructive';
        case 'PENDING': return 'secondary';
        default: return 'outline';
    }
};

export default function WhatsAppPayPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    useEffect(() => {
        const storedId = localStorage.getItem('activeProjectId');
        setActiveProjectId(storedId);
    }, []);

    useEffect(() => {
        if (activeProjectId) {
            startLoading(async () => {
                const [projectData, transactionsData] = await Promise.all([
                    getProjectById(activeProjectId),
                    getTransactionsForProject(activeProjectId)
                ]);
                setProject(projectData);
                setTransactions(transactionsData);
            });
        }
    }, [activeProjectId]);
    
    const stats = transactions.reduce((acc, t) => {
        if (t.status === 'SUCCESS') {
            acc.successfulTransactions++;
            acc.totalRevenue += t.amount / 100;
        }
        return acc;
    }, { successfulTransactions: 0, totalRevenue: 0 });

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!activeProjectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project from the main dashboard to manage its payments.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <WaPayIcon className="h-8 w-8" />
                    WhatsApp Payments
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage your payment configurations and view transaction history for project "{project?.name}".
                </p>
            </div>
            
             <div className="grid gap-4 md:grid-cols-3">
                <StatCard title="Total Revenue (INR)" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={IndianRupee} />
                <StatCard title="Successful Transactions" value={stats.successfulTransactions} icon={CheckCircle} />
                <StatCard title="Failed/Pending" value={transactions.length - stats.successfulTransactions} icon={XCircle} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>A log of all payments initiated for this project.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Transaction ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length > 0 ? (
                                    transactions.map((t) => (
                                        <TableRow key={t._id.toString()}>
                                            <TableCell>{format(new Date(t.createdAt), 'PPp')}</TableCell>
                                            <TableCell className="font-medium">{t.description}</TableCell>
                                            <TableCell>₹{(t.amount / 100).toFixed(2)}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                                            <TableCell className="font-mono text-xs">{t._id.toString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No transactions found for this project.</TableCell>
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
