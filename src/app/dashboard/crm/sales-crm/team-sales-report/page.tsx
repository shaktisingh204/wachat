'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruDatePicker,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { Download, TrendingUp } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';

import { CrmPageHeader } from '../../_components/crm-page-header';

export default function TeamSalesReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

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

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Lead Created At</ZoruLabel><ZoruDatePicker value={startDate} onChange={setStartDate as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><ZoruLabel>&nbsp;</ZoruLabel><ZoruDatePicker value={endDate} onChange={setEndDate as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Pipeline</ZoruLabel><ZoruSelect value={pipelineId} onValueChange={setPipelineId}><ZoruSelectTrigger><ZoruSelectValue placeholder="All Pipelines" /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="sales">Sales Pipeline</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Assigned To</ZoruLabel><ZoruSelect value={assigneeId} onValueChange={setAssigneeId}><ZoruSelectTrigger><ZoruSelectValue placeholder="All Assignees" /></ZoruSelectTrigger><ZoruSelectContent>{users.map(u => <ZoruSelectItem key={u._id} value={u._id}>{u.name}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                </div>
                <div className="mt-4 flex gap-2">
                    <ZoruButton onClick={fetchData} disabled={isLoading}>
                        Apply Filters
                    </ZoruButton>
                    <ZoruButton variant="ghost" onClick={clearFilters}>Clear Filters</ZoruButton>
                </div>
            </ZoruCard>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportStat label="Total Revenue" value={`₹${reportData.reduce((sum, d) => sum + d.totalRevenue, 0).toLocaleString()}`} />
                <ReportStat label="Total Leads" value={reportData.reduce((sum, d) => sum + d.totalLeads, 0)} />
                <ReportStat label="Deals Closed" value={reportData.reduce((sum, d) => sum + d.closedLeads, 0)} />
                <ReportStat label="Avg. Deal Value" value={`₹${(reportData.reduce((sum, d) => sum + d.avgDealValue, 0) / (reportData.length || 1)).toFixed(0)}`} />
            </div>

            <ZoruCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-foreground">Salesperson Performance</h2>
                    <ZoruButton variant="outline" onClick={handleDownload}>
                        Download CSV
                    </ZoruButton>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Salesperson</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Total Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Open</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Closed</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Lost</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Conversion Rate</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Total Revenue</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Avg. Deal Value</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={8} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></ZoruTableCell></ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <ZoruTableRow key={row.salespersonId} className="border-border">
                                        <ZoruTableCell>
                                            <div className="font-medium text-foreground">{row.salespersonName}</div>
                                            <div className="text-[11.5px] text-muted-foreground">{row.salespersonEmail}</div>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.totalLeads}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.openLeads}</ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-green-600">{row.closedLeads}</ZoruTableCell>
                                        <ZoruTableCell className="font-semibold text-red-600">{row.lostLeads}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.conversionRate.toFixed(1)}%</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">₹{row.totalRevenue.toLocaleString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">₹{row.avgDealValue.toLocaleString()}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-muted-foreground">No data available for the selected filters.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
