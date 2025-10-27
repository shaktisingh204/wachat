
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, SlidersHorizontal, Trash2 } from 'lucide-react';
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useTransition } from "react";
import { generateTrialBalanceData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";

type TrialBalanceEntry = {
    accountId: string;
    accountName: string;
    openingBalance: number;
    openingBalanceType: 'Cr' | 'Dr';
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: 'Cr' | 'Dr';
};

const yourBusinessDetails = {
    name: 'WAPLIA DIGITAL SOLUTIONS',
    address: 'D-829, Malviya Nagar, Jaipur, India - 302017',
    gstin: '08FNSPK2133N1ZE',
};

function TrialBalanceClient({ data, totals }: { data: TrialBalanceEntry[], totals: any }) {
    const [hideZero, setHideZero] = useState(false);
    const filteredData = hideZero ? data.filter(d => d.totalDebit > 0 || d.totalCredit > 0) : data;

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center rounded-full text-3xl font-bold">
                        W
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{yourBusinessDetails.name}</h1>
                        <p className="text-sm text-muted-foreground">{yourBusinessDetails.address}</p>
                        <p className="text-sm text-muted-foreground">GSTIN: {yourBusinessDetails.gstin}</p>
                    </div>
                </div>
                 <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download PDF</Button>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                     <div className="space-y-2">
                        <Label>Financial Year</Label>
                        <Select defaultValue="fy2526">
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="flex items-center gap-2">
                            <DatePicker date={new Date('2025-04-01')} />
                            <span>-</span>
                            <DatePicker date={new Date('2026-03-31')} />
                        </div>
                    </div>
                     <Button>Apply</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Trial Balance</CardTitle>
                        <div className="flex items-center space-x-2">
                            <Switch id="hide-zero" checked={hideZero} onCheckedChange={setHideZero} />
                            <Label htmlFor="hide-zero">Hide Zero-Entry Accounts</Label>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account</TableHead>
                                    <TableHead className="text-right">Opening Balance</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead className="text-right">Closing Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.length > 0 ? (
                                    filteredData.map(entry => (
                                        <TableRow key={entry.accountId}>
                                            <TableCell className="font-medium">{entry.accountName}</TableCell>
                                            <TableCell className="text-right font-mono">{Math.abs(entry.openingBalance).toFixed(2)} {entry.openingBalanceType}</TableCell>
                                            <TableCell className="text-right font-mono">{entry.totalDebit.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{entry.totalCredit.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">{Math.abs(entry.closingBalance).toFixed(2)} {entry.closingBalanceType}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No Data</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <CardFooter className="bg-muted font-bold">
                                <TableRow>
                                    <TableCell>Total</TableCell>
                                    <TableCell className="text-right font-mono">{Math.abs(totals.totalOpening).toFixed(2)} {totals.totalOpening >= 0 ? 'Dr' : 'Cr'}</TableCell>
                                    <TableCell className="text-right font-mono">{totals.totalDebit.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">{totals.totalCredit.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">{Math.abs(totals.totalClosing).toFixed(2)} {totals.totalClosing >= 0 ? 'Dr' : 'Cr'}</TableCell>
                                </TableRow>
                            </CardFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function TrialBalancePage() {
    const [data, setData] = useState<{data: TrialBalanceEntry[], totals: any} | null>(null);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const result = await generateTrialBalanceData();
            setData(result);
        });
    }, []);

    if (isLoading || !data) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return <TrialBalanceClient data={data.data} totals={data.totals} />;
}
