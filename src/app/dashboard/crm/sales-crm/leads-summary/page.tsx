'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getLeadsSummaryData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle, AlertCircle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

const StatCard = ({ title, value }: { title: string, value: number }) => (
    <ClayCard>
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-[28px] font-semibold text-foreground">{value.toLocaleString()}</p>
    </ClayCard>
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
    );
}

export default function LeadsSummaryPage() {
    const [summaryData, setSummaryData] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

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
        setFilters(prev => ({ ...prev, [key]: value }));
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
        );
    }

    const { summary, pipelineSummary, filtersData } = summaryData;

    const activeFilters = Object.entries(filters).filter(([key, value]: [string, any]) => value && (typeof value !== 'object' || ((value as any).from || (value as any).to)));

    const FilterPill = ({ filterKey, value }: { filterKey: string; value: any }) => {
        let label = filterKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        let displayValue = value;
        if (typeof value === 'object' && (value.from || value.to)) {
            displayValue = `${value.from ? format(value.from, 'PP') : '...'} - ${value.to ? format(value.to, 'PP') : '...'}`;
        }

        return (
            <ClayBadge tone="rose-soft">
                {label}: {displayValue}
            </ClayBadge>
        );
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Leads Summary"
                subtitle="A high-level overview of your sales pipeline performance."
                icon={Users}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="New Leads" value={summary.newLeads} />
                <StatCard title="Scheduled Leads" value={summary.scheduledLeads} />
                <StatCard title="Overdue Leads" value={summary.overdueLeads} />
                <StatCard title="Leads Closed" value={summary.closedLeads} />
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label className="text-foreground">Pipeline</Label><Select value={filters.pipelineId} onValueChange={v => handleFilterChange('pipelineId', v)}><SelectTrigger><SelectValue placeholder="Sales Pipeline" /></SelectTrigger><SelectContent>{(filtersData.pipelines || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Lead Source</Label><Select value={filters.leadSource} onValueChange={v => handleFilterChange('leadSource', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(filtersData.leadSources || []).map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Assigned To</Label><Select value={filters.assigneeId} onValueChange={v => handleFilterChange('assigneeId', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(filtersData.assignees || []).map((a: any) => <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Current Stage</Label><Select value={filters.currentStage} onValueChange={v => handleFilterChange('currentStage', v)}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{(filtersData.pipelines[0]?.stages || []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Created Date</Label><DatePicker date={filters.createdFrom} setDate={((d: any) => handleFilterChange('createdFrom', d)) as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.createdTo} setDate={((d: any) => handleFilterChange('createdTo', d)) as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label className="text-foreground">Updated Date</Label><DatePicker date={filters.updatedFrom} setDate={((d: any) => handleFilterChange('updatedFrom', d)) as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.updatedTo} setDate={((d: any) => handleFilterChange('updatedTo', d)) as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label className="text-foreground">Closed Date</Label><DatePicker date={filters.closedFrom} setDate={((d: any) => handleFilterChange('closedFrom', d)) as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={filters.closedTo} setDate={((d: any) => handleFilterChange('closedTo', d)) as any} placeholder="End Date" /></div>
                </div>
                <div className="mt-4">
                    <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} leading={isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
                        Apply Filters
                    </ClayButton>
                </div>
            </ClayCard>

            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[13px] font-semibold text-foreground">Applied Filters:</span>
                {activeFilters.length > 0 ? (
                    activeFilters.map(([key, value]) => <FilterPill key={key} filterKey={key} value={value} />)
                ) : (
                    <span className="text-[13px] text-muted-foreground">None</span>
                )}
                {activeFilters.length > 0 && <ClayButton variant="ghost" size="sm" onClick={resetFilters}>Reset all filters</ClayButton>}
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Graph</h2>
                </div>
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
            </ClayCard>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Sales Pipeline Summary</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {pipelineSummary.map((stage: any) => (
                        <div key={stage.name} className="rounded-lg border border-border bg-secondary p-4 text-center">
                            <h3 className="text-[13px] font-semibold text-foreground">{stage.name}</h3>
                            <p className="text-[22px] font-semibold text-foreground">{stage.leadCount}</p>
                            <p className="text-[11.5px] text-muted-foreground">Leads</p>
                            <p className="mt-2 text-[11.5px] text-muted-foreground">Total: ₹{stage.totalValue.toLocaleString()}</p>
                            <p className="text-[11.5px] text-muted-foreground">Weighted: ₹{stage.weightedValue.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </ClayCard>
        </div>
    );
}
