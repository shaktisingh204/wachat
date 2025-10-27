
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, SlidersHorizontal, Trash2, ChevronDown, Building, AlertCircle } from 'lucide-react';
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Label } from '@/components/ui/label';
import { useState, useEffect, useTransition, useCallback } from "react";
import { generateTrialBalanceData } from "@/app/actions/crm-accounting.actions";
import { LoaderCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { getSession } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

function TrialBalanceClient({ data, totals, user }: { data: TrialBalanceEntry[], totals: any, user: any }) {
    const [hideZero, setHideZero] = useState(false);
    const filteredData = hideZero ? data.filter(d => d.totalDebit > 0 || d.totalCredit > 0) : data;
    const { toast } = useToast();
    
    const businessProfile = user?.businessProfile;

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        const dataToExport = filteredData.map(entry => ({
            "Account": entry.accountName,
            "Opening Balance": `${Math.abs(entry.openingBalance).toFixed(2)} ${entry.openingBalanceType}`,
            "Debit": entry.totalDebit.toFixed(2),
            "Credit": entry.totalCredit.toFixed(2),
            "Closing Balance": `${Math.abs(entry.closingBalance).toFixed(2)} ${entry.closingBalanceType}`
        }));
        
        if (format === 'csv') {
            const csv = Papa.unparse(dataToExport);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'trial-balance.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary text-primary-foreground flex items-center justify-center rounded-full text-3xl font-bold">
                        {businessProfile?.name?.charAt(0) || 'B'}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">{businessProfile?.name || 'Your Business'}</h1>
                        <p className="text-sm text-muted-foreground">{businessProfile?.address || 'Your Address'}</p>
                        <p className="text-sm text-muted-foreground">GSTIN: {businessProfile?.gstin || 'N/A'}</p>
                    </div>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download As<ChevronDown className="ml-2 h-4 w-4"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                        <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                        <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>Trial Balance</CardTitle>
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
                     <div className="flex items-center justify-end mt-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="hide-zero" checked={hideZero} onCheckedChange={setHideZero} />
                            <Label htmlFor="hide-zero">Hide Zero-Entry Accounts</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function TrialBalancePage() {
    const [data, setData] = useState<{data: TrialBalanceEntry[], totals: any} | null>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, startTransition] = useTransition();

    const defaultStartDate = new Date(new Date().getFullYear(), 3, 1);
    const defaultEndDate = new Date(new Date().getFullYear() + 1, 2, 31);
    const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
    const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);

    const fetchData = useCallback(() => {
         startTransition(async () => {
            const [dataResult, session] = await Promise.all([
                generateTrialBalanceData(startDate, endDate),
                getSession()
            ]);
            setData(dataResult);
            setUser(session?.user);
        });
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleClearFilters = () => {
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
    }

    useEffect(() => {
        if (startDate === defaultStartDate && endDate === defaultEndDate) {
            fetchData();
        }
    }, [startDate, endDate, defaultStartDate, defaultEndDate, fetchData]);
    
    if (isLoading || !data || !user) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (!user.businessProfile?.name || !user.businessProfile.address) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Business Profile Incomplete</AlertTitle>
                <AlertDescription>
                    Please complete your business profile in the user settings to view accounting reports.
                    <Button asChild variant="link" className="p-0 h-auto ml-2"><Link href="/dashboard/user/settings/profile">Go to Settings</Link></Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filters</Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 space-y-4">
                     <div className="space-y-2">
                        <Label>Start Date</Label>
                        <DatePicker date={startDate} setDate={setStartDate} />
                    </div>
                    <div className="space-y-2">
                        <Label>End Date</Label>
                        <DatePicker date={endDate} setDate={setEndDate} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={handleClearFilters}>Clear</Button>
                        <Button onClick={fetchData} disabled={isLoading}>
                             {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                             Apply
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            <div className="mt-6">
                <TrialBalanceClient data={data.data} totals={data.totals} user={user} />
            </div>
        </>
    );
}
