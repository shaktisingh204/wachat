'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, LoaderCircle, BookOpen } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateSalaryRegisterData } from "@/app/actions/crm-hr-reports.actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';

export default function SalaryRegisterPage() {
    const [reportData, setReportData] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const result = await generateSalaryRegisterData({});
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
        link.setAttribute('download', 'salary_register.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Salary Register"
                subtitle="A detailed breakdown of salary components for each employee."
                icon={BookOpen}
                actions={
                    <ClayButton variant="pill" onClick={handleDownload} disabled={isLoading || reportData.length === 0} leading={<Download className="h-4 w-4"/>}>
                        Download CSV
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Register Details</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Employee</TableHead>
                                <TableHead className="text-clay-ink-muted">Department</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Gross Salary</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Deductions</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Net Salary</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-clay-ink-muted"/></TableCell></TableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map(row => (
                                    <TableRow key={row._id} className="border-clay-border">
                                        <TableCell className="text-[13px] font-medium text-clay-ink">{row.employeeName}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{row.department || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-mono text-[13px] text-clay-ink">₹{row.grossSalary?.toLocaleString() || '0'}</TableCell>
                                        <TableCell className="text-right font-mono text-[13px] text-destructive">- ₹{row.deductions?.toLocaleString() || '0'}</TableCell>
                                        <TableCell className="text-right font-mono text-[13px] font-bold text-clay-ink">₹{row.netSalary?.toLocaleString() || '0'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">No salary data found for active employees.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
