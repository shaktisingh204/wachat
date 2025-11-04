
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, UserCheck, UserX } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateAttendanceReportData } from "@/app/actions/crm-hr-reports.actions";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

const StatCard = ({ title, value }: { title: string, value: string }) => (
    <div className="bg-muted/50 p-4 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
    </div>
);

export default function AttendanceReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    // Filters State
    const [startDate, setStartDate] = useState<Date | undefined>(new Date(new Date().setDate(1)));
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateAttendanceReportData({ startDate, endDate });
            if (result.error) {
                toast({ title: "Error generating report", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data || []);
                setSummary(result.summary || {});
            }
        });
    }, [startDate, endDate, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownload = () => {
        if (reportData.length === 0) {
            toast({ title: 'No Data', description: 'There is no data to download.' });
            return;
        }
        const csv = Papa.unparse(reportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `attendance_report_${format(startDate!, 'yyyy-MM-dd')}_to_${format(endDate!, 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <div className="space-y-6">
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Attendance Report</h1>
                    <p className="text-muted-foreground">Detailed attendance summary for your employees.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4"/>Filters</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 space-y-4">
                            <div className="space-y-2"><Label>Start Date</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                            <div className="space-y-2"><Label>End Date</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                            <Button onClick={fetchData} disabled={isLoading} className="w-full">
                                {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Apply
                            </Button>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
                </div>
            </div>
            
            <Card>
                 <CardHeader>
                    <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Employees" value={summary.totalEmployees?.toLocaleString() || '0'} />
                    <StatCard title="Overall Attendance" value={`${summary.overallAttendance?.toFixed(1) || '0.0'}%`} />
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Employee Attendance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Total Days</TableHead>
                                    <TableHead className="text-green-600">Present</TableHead>
                                    <TableHead className="text-red-600">Absent</TableHead>
                                    <TableHead>Half Day</TableHead>
                                    <TableHead>Leave</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row.employeeId}>
                                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                                            <TableCell>{row.totalDays}</TableCell>
                                            <TableCell className="font-semibold text-green-600">{row.present}</TableCell>
                                            <TableCell className="font-semibold text-red-600">{row.absent}</TableCell>
                                            <TableCell>{row.halfDay}</TableCell>
                                            <TableCell>{row.leave}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No attendance data for the selected period.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
