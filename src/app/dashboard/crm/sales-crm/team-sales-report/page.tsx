'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, Trash2, LineChart, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

export default function TeamSalesReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    // Filters State
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
                assigneeId
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
            toast({ title: 'No Data', description: 'There is no report data to download.'});
            return;
        }
        const csv = Papa.unparse(reportData.map(d => ({
            ...d,
            conversionRate: d.conversionRate.toFixed(1) + '%',
            totalRevenue: d.totalRevenue.toFixed(2),
            avgDealValue: d.avgDealValue.toFixed(2)
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
    }

    const ReportStat = ({ label, value, subValue }: { label: string, value: string | number, subValue?: string }) => (
        <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline">Team Sales Report</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1"><Label>Lead Created At</Label><DatePicker date={startDate} setDate={setStartDate} placeholder="Start Date" /></div>
                    <div className="space-y-1"><Label>&nbsp;</Label><DatePicker date={endDate} setDate={setEndDate} placeholder="End Date" /></div>
                    <div className="space-y-1"><Label>Pipeline</Label><Select value={pipelineId} onValueChange={setPipelineId}><SelectTrigger><SelectValue placeholder="All Pipelines"/></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label>Assigned To</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue placeholder="All Assignees"/></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
                </CardContent>
                 <CardFooter className="gap-2">
                    <Button onClick={fetchData} disabled={isLoading}>
                         {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Apply Filters
                    </Button>
                    <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
                </CardFooter>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportStat label="Total Revenue" value={`₹${reportData.reduce((sum, d) => sum + d.totalRevenue, 0).toLocaleString()}`} />
                <ReportStat label="Total Leads" value={reportData.reduce((sum, d) => sum + d.totalLeads, 0)} />
                <ReportStat label="Deals Closed" value={reportData.reduce((sum, d) => sum + d.closedLeads, 0)} />
                <ReportStat label="Avg. Deal Value" value={`₹${(reportData.reduce((sum, d) => sum + d.avgDealValue, 0) / (reportData.length || 1)).toFixed(0)}`} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Salesperson Performance</CardTitle>
                        <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Salesperson</TableHead>
                                    <TableHead>Total Leads</TableHead>
                                    <TableHead>Open</TableHead>
                                    <TableHead>Closed</TableHead>
                                    <TableHead>Lost</TableHead>
                                    <TableHead>Conversion Rate</TableHead>
                                    <TableHead>Total Revenue</TableHead>
                                    <TableHead>Avg. Deal Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row.salespersonId}>
                                            <TableCell>
                                                <div className="font-medium">{row.salespersonName}</div>
                                                <div className="text-xs text-muted-foreground">{row.salespersonEmail}</div>
                                            </TableCell>
                                            <TableCell>{row.totalLeads}</TableCell>
                                            <TableCell>{row.openLeads}</TableCell>
                                            <TableCell className="text-green-600 font-semibold">{row.closedLeads}</TableCell>
                                            <TableCell className="text-destructive font-semibold">{row.lostLeads}</TableCell>
                                            <TableCell>{row.conversionRate.toFixed(1)}%</TableCell>
                                            <TableCell>₹{row.totalRevenue.toLocaleString()}</TableCell>
                                            <TableCell>₹{row.avgDealValue.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={8} className="h-24 text-center">No data available for the selected filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
