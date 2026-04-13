'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, BarChart } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateLeadSourceReportData, generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function LeadSourceReportPage() {
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
            const [leadSourceData, teamData] = await Promise.all([
                generateLeadSourceReportData({
                    createdFrom: startDate,
                    createdTo: endDate,
                    pipelineId,
                    assigneeId,
                }),
                generateTeamSalesReportData({}),
            ]);
            setReportData(leadSourceData);
            setUsers(teamData.users);
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
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'lead_source_report.csv');
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
                title="Lead Source Report"
                subtitle="Analyze the effectiveness of your lead sources."
                icon={BarChart}
                actions={
                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={handleDownload}>
                        Download CSV
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label className="text-clay-ink">Lead Created At</Label><DatePicker date={startDate} setDate={setStartDate as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={endDate} setDate={setEndDate as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label className="text-clay-ink">Pipeline</Label><Select value={pipelineId} onValueChange={setPipelineId}><SelectTrigger><SelectValue placeholder="All Pipelines" /></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-clay-ink">Assigned To</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue placeholder="All Assignees" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.salespersonId} value={u.salespersonId}>{u.salespersonName}</SelectItem>)}</SelectContent></Select></div>
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
                    <h2 className="text-[16px] font-semibold text-clay-ink">Report Data</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Showing results for {reportData.length} lead source(s).</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Lead Source</TableHead>
                                <TableHead className="text-clay-ink-muted">Total Revenue</TableHead>
                                <TableHead className="text-clay-ink-muted">Lead Conversion Rate</TableHead>
                                <TableHead className="text-clay-ink-muted">Leads Generated</TableHead>
                                <TableHead className="text-clay-ink-muted">Open Leads</TableHead>
                                <TableHead className="text-clay-ink-muted">Closed Leads</TableHead>
                                <TableHead className="text-clay-ink-muted">Lost Leads</TableHead>
                                <TableHead className="text-clay-ink-muted">Not Serviceable</TableHead>
                                <TableHead className="text-clay-ink-muted">Avg. Deal Value</TableHead>
                                <TableHead className="text-clay-ink-muted">Avg Lead Closure Time (Days)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={10} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" /></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <TableRow key={row.leadSource} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{row.leadSource}</TableCell>
                                        <TableCell className="text-clay-ink">₹{row.totalRevenue.toLocaleString()}</TableCell>
                                        <TableCell className="text-clay-ink">{row.leadConversionRate.toFixed(1)}%</TableCell>
                                        <TableCell className="text-clay-ink">{row.leadsGenerated}</TableCell>
                                        <TableCell className="text-clay-ink">{row.openLeads}</TableCell>
                                        <TableCell className="text-green-600">{row.closedLeads}</TableCell>
                                        <TableCell className="text-red-600">{row.lostLeads}</TableCell>
                                        <TableCell className="text-clay-ink">{row.notServiceable}</TableCell>
                                        <TableCell className="text-clay-ink">₹{row.avgDealValue.toLocaleString()}</TableCell>
                                        <TableCell className="text-clay-ink">{row.avgLeadClosureTime}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={10} className="h-24 text-center text-[13px] text-clay-ink-muted">No data available for the selected filters.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
