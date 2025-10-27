

'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getLeadsSummaryData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle, User, FileText, Calendar, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value }: { title: string, value: number }) => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        </CardContent>
    </Card>
);

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1"><Skeleton className="h-96" /></div>
                <div className="lg:col-span-2"><Skeleton className="h-96" /></div>
            </div>
        </div>
    )
}

export default function LeadsSummaryPage() {
    const [summaryData, setSummaryData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const data = await getLeadsSummaryData({});
            setSummaryData(data);
        });
    }, []);

    if (isLoading || !summaryData) {
        return <PageSkeleton />;
    }
    
    if (!summaryData) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Could not load summary data. Please ensure deals have been added to the CRM.</AlertDescription>
            </Alert>
        )
    }

    const { summary, pipelineSummary, filtersData } = summaryData;
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Summary</h2>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="New Leads" value={summary.newLeads} />
                <StatCard title="Scheduled Leads" value={summary.scheduledLeads} />
                <StatCard title="Overdue Leads" value={summary.overdueLeads} />
                <StatCard title="Leads Closed" value={summary.closedLeads} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Select><SelectTrigger><SelectValue placeholder="Sales Pipeline"/></SelectTrigger><SelectContent>{(filtersData.pipelines || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                    <Select><SelectTrigger><SelectValue placeholder="Lead Source"/></SelectTrigger><SelectContent>{(filtersData.leadSources || []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    <Select><SelectTrigger><SelectValue placeholder="Assigned To"/></SelectTrigger><SelectContent>{(filtersData.assignees || []).map((a: any) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select>
                    <DatePicker placeholder="Lead created date" />
                    <DatePicker placeholder="Lead updated date" />
                    <DatePicker placeholder="Lead closed date" />
                    <Select><SelectTrigger><SelectValue placeholder="Current Lead Stages"/></SelectTrigger><SelectContent/></Select>
                    <Select><SelectTrigger><SelectValue placeholder="Labels"/></SelectTrigger><SelectContent/></Select>
                </CardContent>
            </Card>
            
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold">Applied Filters:</span>
                <Badge variant="secondary" className="gap-1">Pipeline: <span className="font-bold">Sales Pipeline</span></Badge>
                <Badge variant="secondary" className="gap-1">Assignee: <span className="font-bold">Waplia Digital Solutions</span></Badge>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Reset all filters</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sales Pipeline Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {pipelineSummary.map((stage: any) => (
                        <div key={stage.name} className="p-4 bg-muted/50 rounded-lg text-center">
                            <h3 className="font-semibold">{stage.name}</h3>
                            <p className="text-2xl font-bold">{stage.leadCount}</p>
                            <p className="text-xs text-muted-foreground">Leads</p>
                            <p className="text-xs text-muted-foreground mt-2">Total: ₹{stage.totalValue.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Weighted: ₹{stage.weightedValue.toLocaleString()}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Graph</CardTitle>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={pipelineSummary}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="leadCount" fill="hsl(var(--primary))" name="Lead Count" />
                            <Bar dataKey="totalValue" fill="hsl(var(--secondary))" name="Total Value" />
                            <Bar dataKey="weightedValue" fill="hsl(var(--accent-foreground))" name="Weighted Value" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
