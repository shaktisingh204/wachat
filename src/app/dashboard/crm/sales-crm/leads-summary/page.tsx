
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getLeadsSummaryData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle, User, FileText, Calendar, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
    const { toast } = useToast();

    // Filters State
    const [filters, setFilters] = useState({
        pipelineId: '',
        leadSource: '',
        assigneeId: '',
        createdFrom: undefined as Date | undefined,
        createdTo: undefined as Date | undefined,
        updatedFrom: undefined as Date | undefined,
        updatedTo: undefined as Date | undefined,
        closedFrom: undefined as Date | undefined,
        closedTo: undefined as Date | undefined,
        currentStage: '',
    });

    const fetchData = useCallback(() => {
        startTransition(async () => {
            try {
                const data = await getLeadsSummaryData(filters);
                setSummaryData(data);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to load summary data.', variant: 'destructive' });
            }
        });
    }, [filters, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({...prev, [key]: value}));
    };
    
    const resetFilters = () => {
        setFilters({
            pipelineId: '', leadSource: '', assigneeId: '',
            createdFrom: undefined, createdTo: undefined,
            updatedFrom: undefined, updatedTo: undefined,
            closedFrom: undefined, closedTo: undefined,
            currentStage: '',
        });
    };
    
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
    
    const activeFilters = Object.entries(filters).filter(([key, value]) => value && (typeof value !== 'object' || (value.from || value.to)));

    const FilterPill = ({ filterKey, value }: { filterKey: string; value: any }) => {
        let label = filterKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let displayValue = value;
        if (typeof value === 'object' && (value.from || value.to)) {
            displayValue = `${value.from ? format(value.from, 'PP') : '...'} - ${value.to ? format(value.to, 'PP') : '...'}`;
        }
        
        return (
            <Badge variant="secondary" className="flex items-center gap-1">
                {label}: {displayValue}
            </Badge>
        );
    }
    
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
                    <div className="space-y-1"><Label>Pipeline</Label><Select value={filters.pipelineId} onValueChange={v => handleFilterChange('pipelineId', v)}><SelectTrigger><SelectValue placeholder="Sales Pipeline"/></SelectTrigger><SelectContent>{(filtersData.pipelines || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Lead Source</Label><Select value={filters.leadSource} onValueChange={v => handleFilterChange('leadSource', v)}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{(filtersData.leadSources || []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Assigned To</Label><Select value={filters.assigneeId} onValueChange={v => handleFilterChange('assigneeId', v)}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{(filtersData.assignees || []).map((a: any) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Current Stage</Label><Select value={filters.currentStage} onValueChange={v => handleFilterChange('currentStage', v)}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent>{(filtersData.pipelines[0]?.stages || []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Created Date</Label><DatePicker date={filters.createdFrom} setDate={d => handleFilterChange('createdFrom', d)} placeholder="Start Date"/></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.createdTo} setDate={d => handleFilterChange('createdTo', d)} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label>Updated Date</Label><DatePicker date={filters.updatedFrom} setDate={d => handleFilterChange('updatedFrom', d)} placeholder="Start Date"/></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.updatedTo} setDate={d => handleFilterChange('updatedTo', d)} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label>Closed Date</Label><DatePicker date={filters.closedFrom} setDate={d => handleFilterChange('closedFrom', d)} placeholder="Start Date"/></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.closedTo} setDate={d => handleFilterChange('closedTo', d)} placeholder="End Date" /></div>
                </CardContent>
                 <CardFooter>
                    <Button onClick={fetchData} disabled={isLoading}>
                        {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Apply Filters
                    </Button>
                </CardFooter>
            </Card>
            
             <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold">Applied Filters:</span>
                {activeFilters.length > 0 ? (
                    activeFilters.map(([key, value]) => <FilterPill key={key} filterKey={key} value={value} />)
                ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                )}
                {activeFilters.length > 0 && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={resetFilters}>Reset all filters</Button>}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Graph</CardTitle>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={pipelineSummary}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="leadCount" fill="hsl(var(--primary))" name="Lead Count" />
                            <Bar yAxisId="right" dataKey="totalValue" fill="hsl(var(--secondary))" name="Total Value" />
                            <Bar yAxisId="right" dataKey="weightedValue" fill="hsl(var(--accent-foreground))" name="Weighted Value" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

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

        </div>
    );
}
