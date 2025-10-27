
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState, useEffect, useTransition } from 'react';
import { generateTeamSalesReportData } from '@/app/actions/crm-reports.actions';
import { LoaderCircle } from 'lucide-react';
import Papa from 'papaparse';
import { useToast } from "@/hooks/use-toast";

const ReportStat = ({ label, value, subValue }: { label: string, value: string | number, subValue?: string }) => (
    <div className="p-3 bg-muted rounded-lg text-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
    </div>
);

export default function TeamSalesReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        startTransition(async () => {
            const { data, users } = await generateTeamSalesReportData({});
            setReportData(data);
            setUsers(users);
        })
    }, []);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no report data to download.'});
            return;
        }
        const csv = Papa.unparse(reportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'team_sales_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
                    <div className="space-y-1"><Label>Lead Created At *</Label><DatePicker /></div>
                    <div className="space-y-1"><Label>Lead Closed At</Label><DatePicker /></div>
                    <div className="space-y-1"><Label>Pipeline *</Label><Select defaultValue="sales"><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="sales">Sales Pipeline</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label>Source</Label><Select><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent/></Select></div>
                    <div className="space-y-1"><Label>Label</Label><Select><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent/></Select></div>
                    <div className="space-y-1"><Label>Assigned To</Label><Select><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent/></Select></div>
                    <div className="flex items-end gap-2">
                        <Button className="w-full">Apply Filters</Button>
                        <Button variant="ghost" size="icon"><Trash2 className="h-5 w-5"/></Button>
                    </div>
                </CardContent>
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
