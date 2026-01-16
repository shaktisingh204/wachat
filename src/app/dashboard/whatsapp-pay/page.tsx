'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getPaymentRequests, getTransactionsForProject } from '@/app/actions/whatsapp.actions';
import { getPaymentConfigurations } from '@/app/actions/whatsapp-pay.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, IndianRupee, CheckCircle, XCircle, RefreshCw, LoaderCircle } from 'lucide-react';
import type { Transaction, Project, FacebookPaymentRequest } from '@/lib/definitions';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    const s = status.toLowerCase();
    if (s === 'success' || s === 'completed') return 'default';
    if (s === 'failed' || s === 'canceled') return 'destructive';
    if (s === 'pending') return 'secondary';
    return 'outline';
};

export default function WhatsAppPayPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
    const [paymentRequests, setPaymentRequests] = useState<FacebookPaymentRequest[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const [paymentRequestError, setPaymentRequestError] = useState<string | null>(null);

    const fetchData = useCallback(async (showToast = false) => {
        if (!activeProjectId) return;
        
        startLoading(async () => {
            setPaymentRequestError(null);
            const [projectData, transactionsData, configsData] = await Promise.all([
                getProjectById(activeProjectId),
                getTransactionsForProject(activeProjectId),
                getPaymentConfigurations(activeProjectId)
            ]);
            setProject(projectData);
            setTransactions(transactionsData);

            if (configsData.error) {
                setPaymentRequestError(configsData.error);
            } else if (configsData.configurations.length === 0) {
                setPaymentRequestError("No payment configurations found for this project. Please add one in the 'Setup' tab.");
                setPaymentRequests([]);
            } else if (projectData?.phoneNumbers?.[0]?.id) {
                const requestsData = await getPaymentRequests(activeProjectId, projectData.phoneNumbers[0].id);
                if (requestsData.error) {
                    setPaymentRequestError(requestsData.error);
                } else {
                    setPaymentRequests(requestsData.requests || []);
                }
            }

            if (showToast) {
                toast({ title: "Refreshed", description: "Payment data updated." });
            }
        });
    }, [activeProjectId, toast]);

    useEffect(() => {
        const storedId = localStorage.getItem('activeProjectId');
        setActiveProjectId(storedId);
    }, []);

    useEffect(() => {
        if (activeProjectId) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId]);
    
    const stats = transactions.reduce((acc, t) => {
        if (t.status === 'SUCCESS') {
            acc.successfulTransactions++;
            acc.totalRevenue += t.amount / 100;
        }
        return acc;
    }, { successfulTransactions: 0, totalRevenue: 0 });

    if (isLoading && !project) {
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
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    Payment Transactions
                </h1>
                <Button onClick={() => fetchData(true)} variant="outline" disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                    Refresh
                </Button>
            </div>
            <p className="text-muted-foreground -mt-6">
                View payment history for project "{project?.name}".
            </p>
            
             <div className="grid gap-4 md:grid-cols-3">
                <StatCard title="Total Revenue (Razorpay)" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={IndianRupee} />
                <StatCard title="Successful Transactions" value={stats.successfulTransactions} icon={CheckCircle} />
                <StatCard title="Failed/Pending" value={transactions.length - stats.successfulTransactions} icon={XCircle} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Payment Requests (from Meta)</CardTitle>
                    <CardDescription>A log of the latest payment requests sent via WhatsApp Pay.</CardDescription>
                </CardHeader>
                <CardContent>
                    {paymentRequestError ? (
                         <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Could Not Load Requests</AlertTitle>
                            <AlertDescription>{paymentRequestError}</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                 <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>To</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Request ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentRequests.length > 0 ? (
                                        paymentRequests.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell>{req.created_timestamp ? format(new Date(req.created_timestamp * 1000), 'PPp') : 'N/A'}</TableCell>
                                                <TableCell className="font-medium">{req.description}</TableCell>
                                                <TableCell>{req.receiver.wa_id}</TableCell>
                                                <TableCell>₹{req.amount.value}</TableCell>
                                                <TableCell><Badge variant={getStatusVariant(req.status)} className="capitalize">{req.status?.toLowerCase()}</Badge></TableCell>
                                                <TableCell className="font-mono text-xs">{req.id}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">No recent payment requests found via API.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Local Transaction History (Razorpay)</CardTitle>
                    <CardDescription>A log of all payments initiated from this platform.</CardDescription>
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
