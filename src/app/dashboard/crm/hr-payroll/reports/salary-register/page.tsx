
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, LoaderCircle } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { generateSalaryRegisterData } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

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
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Salary Register</h1>
                    <p className="text-muted-foreground">A detailed breakdown of salary components for each employee.</p>
                </div>
                 <Button variant="outline" onClick={handleDownload} disabled={isLoading || reportData.length === 0}><Download className="mr-2 h-4 w-4"/>Download CSV</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Register Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-right">Gross Salary</TableHead>
                                    <TableHead className="text-right">Deductions</TableHead>
                                    <TableHead className="text-right">Net Salary</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-48 text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin"/></TableCell></TableRow>
                                ) : reportData.length > 0 ? (
                                    reportData.map(row => (
                                        <TableRow key={row._id}>
                                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                                            <TableCell>{row.department || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-mono">₹{row.grossSalary?.toLocaleString() || '0'}</TableCell>
                                            <TableCell className="text-right font-mono text-destructive">- ₹{row.deductions?.toLocaleString() || '0'}</TableCell>
                                            <TableCell className="text-right font-bold font-mono">₹{row.netSalary?.toLocaleString() || '0'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No salary data found for active employees.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
