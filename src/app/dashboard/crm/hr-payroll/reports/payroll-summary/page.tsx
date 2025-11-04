
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, IndianRupee, Users, BarChart } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generatePayrollSummaryData } from "@/app/actions/crm-hr-reports.actions";
import { LoaderCircle } from "lucide-react";
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { BarChart as RechartsBarChart, Bar as RechartsBar, CartesianGrid, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts';

const chartConfig = { cost: { label: "Cost", color: "hsl(var(--primary))" } };

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
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
        return <div className="flex justify-center items-center h-full"><LoaderCircle className="h-8 w-8 animate-spin"/></div>;
    }

    return (
        <div className="space-y-6">
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Payroll Summary</h1>
                    <p className="text-muted-foreground">High-level overview of your payroll expenses.</p>
                </div>
                 <Button variant="outline" disabled><Download className="mr-2 h-4 w-4"/>Download Report</Button>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Gross Payroll" value={`₹${summary.totalPayroll?.toLocaleString() || '0'}`} icon={IndianRupee} />
                <StatCard title="Active Employees" value={summary.totalEmployees?.toLocaleString() || '0'} icon={Users} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly Payroll Cost Trend</CardTitle>
                    <CardDescription>Estimated gross payroll cost over the last 6 months.</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>
        </div>
    );
}
