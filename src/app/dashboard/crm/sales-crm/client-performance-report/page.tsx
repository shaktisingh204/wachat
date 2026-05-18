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
import { Download } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateClientPerformanceReportData, generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';

import { format } from "date-fns";

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ClientPerformanceReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();

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
        <EntityListShell
            title="Client Performance Report"
            subtitle="Analyze revenue and lead metrics for each client account."
            primaryAction={
                <ZoruButton variant="outline" onClick={handleDownload}>
                    Download CSV
                </ZoruButton>
            }
        >

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Filters</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Lead Created At</ZoruLabel><ZoruDatePicker value={startDate} onChange={setStartDate as any} placeholder="Start Date" /></div>
                    <div className="space-y-1"><ZoruLabel>&nbsp;</ZoruLabel><ZoruDatePicker value={endDate} onChange={setEndDate as any} placeholder="End Date" /></div>
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Pipeline</ZoruLabel><ZoruSelect value={pipelineId} onValueChange={setPipelineId}><ZoruSelectTrigger><ZoruSelectValue placeholder="All Pipelines" /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="sales">Sales Pipeline</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                    <div className="space-y-1"><ZoruLabel className="text-foreground">Assigned To</ZoruLabel><ZoruSelect value={assigneeId} onValueChange={setAssigneeId}><ZoruSelectTrigger><ZoruSelectValue placeholder="All Assignees" /></ZoruSelectTrigger><ZoruSelectContent>{users.map(u => <ZoruSelectItem key={u.salespersonId} value={u.salespersonId}>{u.salespersonName}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                </div>
                <div className="mt-4 flex gap-2">
                    <ZoruButton onClick={fetchData} disabled={isLoading}>
                        Apply Filters
                    </ZoruButton>
                    <ZoruButton variant="ghost" onClick={clearFilters}>Clear Filters</ZoruButton>
                </div>
            </ZoruCard>

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Report Data</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {reportData.length} of {reportData.length} clients.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Client</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Total Revenue</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Lead Conversion Rate</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Leads Generated</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Open Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Closed Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Lost Leads</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Not Serviceable</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Avg. Deal Value</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Last Lead Activity On</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={10} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></ZoruTableCell></ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <ZoruTableRow key={row.clientId} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{row.clientName}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">₹{row.totalRevenue.toLocaleString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.leadConversionRate.toFixed(1)}%</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.leadsGenerated}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.openLeads}</ZoruTableCell>
                                        <ZoruTableCell className="text-green-600">{row.closedLeads}</ZoruTableCell>
                                        <ZoruTableCell className="text-red-600">{row.lostLeads}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.notServiceable}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">₹{row.avgDealValue.toLocaleString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.lastLeadActivityOn ? format(new Date(row.lastLeadActivityOn), 'PPP') : 'N/A'}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={10} className="h-24 text-center text-[13px] text-muted-foreground">No data available for the selected filters.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
