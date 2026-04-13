'use client';

import { Download, IndianRupee, Users, FileSpreadsheet } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generatePayrollSummaryData } from "@/app/actions/crm-hr-reports.actions";
import { LoaderCircle } from "lucide-react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart as RechartsBarChart, Bar as RechartsBar, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });

const chartConfig = { cost: { label: "Cost", color: "hsl(var(--primary))" } };

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <ClayCard>
        <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-clay-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-clay-ink-muted" strokeWidth={1.75} />
        </div>
        <div className="mt-2 text-2xl font-bold text-clay-ink">{value}</div>
    </ClayCard>
);

export default function PayrollSummaryPage() {
    const [summary, setSummary] = useState<any>({});
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generatePayrollSummaryData({});
            if (result.data) {
                setSummary(result.data);
            }
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-clay-ink-muted"/></div>;
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Payroll Summary"
                subtitle="High-level overview of your payroll expenses."
                icon={FileSpreadsheet}
                actions={
                    <ClayButton variant="pill" disabled leading={<Download className="h-4 w-4"/>}>Download Report</ClayButton>
                }
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Gross Payroll" value={`₹${summary.totalPayroll?.toLocaleString() || '0'}`} icon={IndianRupee} />
                <StatCard title="Active Employees" value={summary.totalEmployees?.toLocaleString() || '0'} icon={Users} />
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Monthly Payroll Cost Trend</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Estimated gross payroll cost over the last 6 months.</p>
                </div>
                <ChartContainer config={chartConfig} className="h-64 w-full">
                    <RechartsBarChart data={summary.monthlyData || []}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <RechartsBar dataKey="cost" fill="var(--color-cost)" radius={4} />
                    </RechartsBarChart>
                </ChartContainer>
            </ClayCard>
        </div>
    );
}
