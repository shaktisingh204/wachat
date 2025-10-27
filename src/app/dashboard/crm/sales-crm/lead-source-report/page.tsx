'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, Trash2, Search, Target } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateLeadSourceReportData, generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

export default function LeadSourceReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    // Filters State
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
                    assigneeId
                }),
                 generateTeamSalesReportData({}) // To get users for the filter
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
            toast({ title: 'No Data', description: 'There is no report data to download.'});
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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Search /> Lead Source Report</h1>
                    <p className="text-muted-foreground">Analyze the effectiveness of your lead sources.</p>
                </div>
                 <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label>Lead Created At</Label><DatePicker date={startDate} setDate={setStartDate} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={endDate} setDate={setEndDate} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label>Pipeline</Label><Select value={pipelineId} onValueChange={setPipelineId}><SelectTrigger><SelectValue placeholder="All Pipelines"/></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label>Assigned To</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue placeholder="All Assignees"/></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.salespersonId} value={u.salespersonId}>{u.salespersonName}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
                 <CardFooter className="gap-2">
                    <Button onClick={fetchData} disabled={isLoading}>
                         {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Apply Filters
                    </Button>
                    <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Report Data</CardTitle>
                     <CardDescription>Showing results for {reportData.length} lead source(s).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lead Source</TableHead>
                                    <TableHead>Total Revenue</TableHead>
                                    <TableHead>Lead Conversion Rate</TableHead>
                                    <TableHead>Leads Generated</TableHead>
                                    <TableHead>Open Leads</TableHead>
                                    <TableHead>Closed Leads</TableHead>
                                    <TableHead>Lost Leads</TableHead>
                                    <TableHead>Not Serviceable</TableHead>
                                    <TableHead>Avg. Deal Value</TableHead>
                                    <TableHead>Avg Lead Closure Time (Days)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row.leadSource}>
                                            <TableCell className="font-medium">{row.leadSource}</TableCell>
                                            <TableCell>₹{row.totalRevenue.toLocaleString()}</TableCell>
                                            <TableCell>{row.leadConversionRate.toFixed(1)}%</TableCell>
                                            <TableCell>{row.leadsGenerated}</TableCell>
                                            <TableCell>{row.openLeads}</TableCell>
                                            <TableCell className="text-green-600">{row.closedLeads}</TableCell>
                                            <TableCell className="text-destructive">{row.lostLeads}</TableCell>
                                            <TableCell>{row.notServiceable}</TableCell>
                                            <TableCell>₹{row.avgDealValue.toLocaleString()}</TableCell>
                                            <TableCell>{row.avgLeadClosureTime}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center">No data available for the selected filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
