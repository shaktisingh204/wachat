
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, View } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const StatCard = ({ title, value }: { title: string; value: string }) => (
    <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
    </div>
);

const balanceSheetData = {
    summary: {
        totalAssets: 0,
        totalLiabilities: 0,
        totalCapital: 0,
        debtToEquity: 0,
    },
    entries: [
        { account: 'Asset', amount: 0, percentage: '0.00%', isMain: true },
        { account: 'Liablities and equities', amount: 0, percentage: '0.00%', isMain: true },
        { account: 'Liability', amount: 0, percentage: '0.00%', isMain: false, isSub: true },
        { account: 'Capital', amount: 0, percentage: '0.00%', isMain: false, isSub: true },
    ]
};

export default function BalanceSheetPage() {
    const { summary, entries } = balanceSheetData;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Balance Sheet</h1>
                    <p className="text-muted-foreground">A snapshot of your company's financial health.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 border rounded-md p-1">
                        <Button variant="ghost" size="sm">Vertical View</Button>
                        <Button variant="secondary" size="sm">Horizontal View</Button>
                    </div>
                     <Select defaultValue="fy2526">
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                            <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                        </SelectContent>
                    </Select>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4"/>
                                Download As
                                <ChevronDown className="ml-2 h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>PDF</DropdownMenuItem>
                            <DropdownMenuItem>XLS</DropdownMenuItem>
                            <DropdownMenuItem>CSV</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Summary</CardTitle>
                    <CardDescription>Figures are in INR (₹)</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Assets" value={`₹${summary.totalAssets.toFixed(2)}`} />
                    <StatCard title="Total Liabilities" value={`₹${summary.totalLiabilities.toFixed(2)}`} />
                    <StatCard title="Total Capital" value={`₹${summary.totalCapital.toFixed(2)}`} />
                    <StatCard title="Debt to Equity Ratio" value={`${summary.debtToEquity.toFixed(2)}%`} />
                </CardContent>
            </Card>

            <Card>
                 <CardContent className="pt-6">
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Accounts</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">% of Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map((entry, index) => (
                                    <TableRow key={index} className={entry.isMain ? 'bg-muted/50 font-semibold' : ''}>
                                        <TableCell className={entry.isSub ? 'pl-8' : ''}>{entry.account}</TableCell>
                                        <TableCell className="text-right font-mono">₹{entry.amount.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{entry.percentage}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                        <p>Showing 1 to {entries.length} of {entries.length} entries</p>
                        <p>* Reports are in your business currency INR</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
