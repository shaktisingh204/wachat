'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, LoaderCircle, CalendarX } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateLeaveReportData } from "@/app/actions/crm-hr-reports.actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

export default function LeaveReportPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateLeaveReportData({});
            if (result.error) {
                toast({ title: "Error generating report", description: result.error, variant: 'destructive' });
            } else {
                setReportData(result.data || []);
            }
        });
    }, [toast]);

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
        link.setAttribute('download', 'leave_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Leave Report"
                subtitle="Summarizes leave taken by employees."
                icon={CalendarX}
                actions={
                    <ClayButton variant="pill" onClick={handleDownload} disabled={isLoading || reportData.length === 0} leading={<Download className="h-4 w-4"/>}>
                        Download CSV
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Leave Consumption Summary</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee Name</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Total Leave Days Taken</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={2} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <TableRow key={index} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{row.employeeName}</TableCell>
                                        <TableCell className="text-right text-[13px] font-semibold text-clay-ink">{row.totalLeaveDays}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={2} className="h-24 text-center text-[13px] text-clay-ink-muted">No leave data found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
