'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, LineChart } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateClientPerformanceReportData, generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function ClientPerformanceReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [pipelineId, setPipelineId] = useState<string>('');
    const [assigneeId, setAssigneeId] = useState<string>('');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [{ data, users }, clientData] = await Promise.all([
                generateTeamSalesReportData({}),
                generateClientPerformanceReportData({
                    createdFrom: startDate,
                    createdTo: endDate,
                    pipelineId,
                    assigneeId,
                }),
            ]);
            setUsers(users);
            setReportData(clientData);
        });
    }, [startDate, endDate, pipelineId, assigneeId]);

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
            totalRevenue: d.totalRevenue.toFixed(2),
            leadConversionRate: `${d.leadConversionRate.toFixed(1)}%`,
            avgDealValue: d.avgDealValue.toFixed(2),
            lastLeadActivityOn: d.lastLeadActivityOn ? format(new Date(d.lastLeadActivityOn), 'PPP') : 'N/A',
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'client_performance_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        setPipelineId('');
        setAssigneeId('');
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Client Performance Report"
                subtitle="Analyze revenue and lead metrics for each client account."
                icon={LineChart}
                actions={
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={handleDownload}>
                        Download CSV
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label className="text-foreground">Lead Created At</Label><DatePicker date={startDate} setDate={setStartDate as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={endDate} setDate={setEndDate as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label className="text-foreground">Pipeline</Label><Select value={pipelineId} onValueChange={setPipelineId}><SelectTrigger><SelectValue placeholder="All Pipelines" /></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-foreground">Assigned To</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue placeholder="All Assignees" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.salespersonId} value={u.salespersonId}>{u.salespersonName}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="mt-4 flex gap-2">
                    <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} leading={isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
                        Apply Filters
                    </ClayButton>
                    <ClayButton variant="ghost" onClick={clearFilters}>Clear Filters</ClayButton>
                </div>
            </ClayCard>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Report Data</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {reportData.length} of {reportData.length} clients.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Client</TableHead>
                                <TableHead className="text-muted-foreground">Total Revenue</TableHead>
                                <TableHead className="text-muted-foreground">Lead Conversion Rate</TableHead>
                                <TableHead className="text-muted-foreground">Leads Generated</TableHead>
                                <TableHead className="text-muted-foreground">Open Leads</TableHead>
                                <TableHead className="text-muted-foreground">Closed Leads</TableHead>
                                <TableHead className="text-muted-foreground">Lost Leads</TableHead>
                                <TableHead className="text-muted-foreground">Not Serviceable</TableHead>
                                <TableHead className="text-muted-foreground">Avg. Deal Value</TableHead>
                                <TableHead className="text-muted-foreground">Last Lead Activity On</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border"><TableCell colSpan={10} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <TableRow key={row.clientId} className="border-border">
                                        <TableCell className="font-medium text-foreground">{row.clientName}</TableCell>
                                        <TableCell className="text-foreground">₹{row.totalRevenue.toLocaleString()}</TableCell>
                                        <TableCell className="text-foreground">{row.leadConversionRate.toFixed(1)}%</TableCell>
                                        <TableCell className="text-foreground">{row.leadsGenerated}</TableCell>
                                        <TableCell className="text-foreground">{row.openLeads}</TableCell>
                                        <TableCell className="text-green-600">{row.closedLeads}</TableCell>
                                        <TableCell className="text-red-600">{row.lostLeads}</TableCell>
                                        <TableCell className="text-foreground">{row.notServiceable}</TableCell>
                                        <TableCell className="text-foreground">₹{row.avgDealValue.toLocaleString()}</TableCell>
                                        <TableCell className="text-foreground">{row.lastLeadActivityOn ? format(new Date(row.lastLeadActivityOn), 'PPP') : 'N/A'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-border"><TableCell colSpan={10} className="h-24 text-center text-[13px] text-muted-foreground">No data available for the selected filters.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
