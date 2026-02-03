'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById } from '@/app/actions/index';
import { getTransactionsForProject } from '@/app/actions/whatsapp.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, IndianRupee, CheckCircle, XCircle, RefreshCw, LoaderCircle, Download } from 'lucide-react';
import type { Transaction, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DatePickerWithRange } from '@/components/wabasimplify/whatsapp-pay/date-range-picker';
import { TransactionChart } from '@/components/wabasimplify/whatsapp-pay/transaction-chart';
import { TransactionTable, PaymentTransaction } from '@/components/wabasimplify/whatsapp-pay/transaction-table';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, description, gradient }: { title: string, value: string | number, icon: React.ElementType, description?: string, gradient?: string }) => (
    <Card className={gradient}>
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

export default function WhatsAppPayPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [transactions, setTransactions] = useState<WithId<Transaction>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const fetchData = useCallback(async (showToast = false) => {
        if (!activeProjectId) return;

        startLoading(async () => {
            const [projectData, transactionsData] = await Promise.all([
                getProjectById(activeProjectId),
                getTransactionsForProject(activeProjectId),
            ]);
            setProject(projectData);
            setTransactions(transactionsData);

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

    const handleExport = () => {
        if (!transactions.length) return;

        const csv = Papa.unparse(transactions.map(t => ({
            ID: t._id,
            Date: new Date(t.createdAt).toLocaleString(),
            Description: t.description,
            Amount: t.amount / 100,
            Status: t.status,
            ProjectID: activeProjectId
        })));

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString()}.csv`;
        a.click();
    };

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

    const tableData: PaymentTransaction[] = transactions.map(t => ({
        id: t._id.toString(),
        amount: t.amount,
        status: t.status,
        description: t.description,
        date: t.createdAt.toString() // Or convert to ISO string if needed for the table sorting
    }));

    return (
        <div className="flex flex-col gap-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        Payment Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View payment history and revenue for project "{project?.name}".
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                    <Button onClick={() => fetchData(true)} variant="outline" disabled={isLoading} size="icon">
                        {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleExport} variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                    title="Total Revenue"
                    value={`₹${stats.totalRevenue.toLocaleString()}`}
                    icon={IndianRupee}
                    gradient="card-gradient card-gradient-green"
                />
                <StatCard
                    title="Successful Transactions"
                    value={stats.successfulTransactions}
                    icon={CheckCircle}
                    gradient="card-gradient card-gradient-blue"
                />
                <StatCard
                    title="Failed/Pending"
                    value={transactions.length - stats.successfulTransactions}
                    icon={XCircle}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                    <TransactionChart transactions={transactions} dateRange={dateRange} />
                </div>
            </div>

            <Card className="card-gradient">
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>A detailed log of all payments initiated from this platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <TransactionTable data={tableData} />
                </CardContent>
            </Card>
        </div>
    );
}

