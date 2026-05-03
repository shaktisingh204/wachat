'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, TrendingUp } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function TeamSalesReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('');
    const [leadSource, setLeadSource] = useState<string>('');
    const [assigneeId, setAssigneeId] = useState<string>('');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { data, users } = await generateTeamSalesReportData({
                createdFrom: startDate,
                createdTo: endDate,
                pipelineId,
                leadSource,
                assigneeId,
            });
            setReportData(data);
            setUsers(users);
        });
    }, [startDate, endDate, pipelineId, leadSource, assigneeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no report data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData.map(d => ({
            ...d,
            conversionRate: d.conversionRate.toFixed(1) + '%',
            totalRevenue: d.totalRevenue.toFixed(2),
            avgDealValue: d.avgDealValue.toFixed(2),
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'team_sales_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPipelineId('');
        setLeadSource('');
        setAssigneeId('');
    };

    const ReportStat = ({ label, value, subValue }: { label: string, value: string | number, subValue?: string }) => (
        <div className="rounded-lg border border-border bg-secondary p-3 text-center">
            <p className="text-[13px] text-muted-foreground">{label}</p>
            <p className="text-[22px] font-semibold text-foreground">{value}</p>
            {subValue && <p className="text-[11.5px] text-muted-foreground">{subValue}</p>}
        </div>
    );

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Team Sales Report"
                subtitle="Performance metrics for each salesperson."
                icon={TrendingUp}
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label className="text-foreground">Lead Created At</Label><DatePicker date={startDate} setDate={setStartDate as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={endDate} setDate={setEndDate as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label className="text-foreground">Pipeline</Label><Select value={pipelineId} onValueChange={setPipelineId}><SelectTrigger><SelectValue placeholder="All Pipelines" /></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Assigned To</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue placeholder="All Assignees" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="mt-4 flex gap-2">
                    <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} leading={isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
                        Apply Filters
                    </ClayButton>
                    <ClayButton variant="ghost" onClick={clearFilters}>Clear Filters</ClayButton>
                </div>
            </ClayCard>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportStat label="Total Revenue" value={`₹${reportData.reduce((sum, d) => sum + d.totalRevenue, 0).toLocaleString()}`} />
                <ReportStat label="Total Leads" value={reportData.reduce((sum, d) => sum + d.totalLeads, 0)} />
                <ReportStat label="Deals Closed" value={reportData.reduce((sum, d) => sum + d.closedLeads, 0)} />
                <ReportStat label="Avg. Deal Value" value={`₹${(reportData.reduce((sum, d) => sum + d.avgDealValue, 0) / (reportData.length || 1)).toFixed(0)}`} />
            </div>

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-foreground">Salesperson Performance</h2>
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={handleDownload}>
                        Download CSV
                    </ClayButton>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Salesperson</TableHead>
                                <TableHead className="text-muted-foreground">Total Leads</TableHead>
                                <TableHead className="text-muted-foreground">Open</TableHead>
                                <TableHead className="text-muted-foreground">Closed</TableHead>
                                <TableHead className="text-muted-foreground">Lost</TableHead>
                                <TableHead className="text-muted-foreground">Conversion Rate</TableHead>
                                <TableHead className="text-muted-foreground">Total Revenue</TableHead>
                                <TableHead className="text-muted-foreground">Avg. Deal Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border"><TableCell colSpan={8} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <TableRow key={row.salespersonId} className="border-border">
                                        <TableCell>
                                            <div className="font-medium text-foreground">{row.salespersonName}</div>
                                            <div className="text-[11.5px] text-muted-foreground">{row.salespersonEmail}</div>
                                        </TableCell>
                                        <TableCell className="text-foreground">{row.totalLeads}</TableCell>
                                        <TableCell className="text-foreground">{row.openLeads}</TableCell>
                                        <TableCell className="font-semibold text-green-600">{row.closedLeads}</TableCell>
                                        <TableCell className="font-semibold text-red-600">{row.lostLeads}</TableCell>
                                        <TableCell className="text-foreground">{row.conversionRate.toFixed(1)}%</TableCell>
                                        <TableCell className="text-foreground">₹{row.totalRevenue.toLocaleString()}</TableCell>
                                        <TableCell className="text-foreground">₹{row.avgDealValue.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border"><TableCell colSpan={8} className="h-24 text-center text-[13px] text-muted-foreground">No data available for the selected filters.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
