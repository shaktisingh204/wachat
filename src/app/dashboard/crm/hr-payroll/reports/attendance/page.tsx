'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, SlidersHorizontal, CalendarCheck } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateAttendanceReportData } from "@/app/actions/crm-hr-reports.actions";
import { LoaderCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

const StatCard = ({ title, value }: { title: string; value: string }) => (
    <div className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-4 text-center">
        <p className="text-[12.5px] text-clay-ink-muted">{title}</p>
        <p className="mt-1 text-2xl font-bold text-clay-ink">{value}</p>
    </div>
);

export default function AttendanceReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>({});
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Attendance Report"
                subtitle="Detailed attendance summary for your employees."
                icon={CalendarCheck}
                actions={
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <ClayButton variant="pill" leading={<SlidersHorizontal className="h-4 w-4"/>}>Filters</ClayButton>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 space-y-4">
                                <div className="space-y-2"><Label>Start Date</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                                <div className="space-y-2"><Label>End Date</Label><DatePicker date={endDate} setDate={setEndDate} /></div>
                                <ClayButton variant="obsidian" onClick={fetchData} disabled={isLoading} className="w-full">
                                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Apply
                                </ClayButton>
                            </PopoverContent>
                        </Popover>
                        <ClayButton variant="pill" onClick={handleDownload} disabled={isLoading || reportData.length === 0} leading={<Download className="h-4 w-4"/>}>
                            Download CSV
                        </ClayButton>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Summary</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard title="Total Employees" value={summary.totalEmployees?.toLocaleString() || '0'} />
                    <StatCard title="Overall Attendance" value={`${summary.overallAttendance?.toFixed(1) || '0.0'}%`} />
                </div>
            </ClayCard>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Employee Attendance Breakdown</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Total Days</TableHead>
                                <TableHead className="text-green-600">Present</TableHead>
                                <TableHead className="text-red-600">Absent</TableHead>
                                <TableHead className="text-clay-ink-muted">Half Day</TableHead>
                                <TableHead className="text-clay-ink-muted">Leave</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={6} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <TableRow key={row.employeeId} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{row.employeeName}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{row.totalDays}</TableCell>
                                        <TableCell className="text-[13px] font-semibold text-green-600">{row.present}</TableCell>
                                        <TableCell className="text-[13px] font-semibold text-red-600">{row.absent}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{row.halfDay}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{row.leave}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={6} className="h-24 text-center text-[13px] text-clay-ink-muted">No attendance data for the selected period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
