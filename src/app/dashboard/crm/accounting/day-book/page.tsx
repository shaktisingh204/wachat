'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getDayBookTransactions, type DayBookTransaction } from "@/app/actions/crm-accounting-reports.actions";
import { LoaderCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function DayBookPage() {
    const [date, setDate] = useState<Date>(new Date());
    const [transactions, setTransactions] = useState<DayBookTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [totals, setTotals] = useState({ in: 0, out: 0 });

    useEffect(() => {
        loadData();
    }, [date]);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getDayBookTransactions(date);
            setTransactions(data.transactions);
            setTotals({ in: data.totalIn, out: data.totalOut });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Day Book</h1>
                    <p className="text-muted-foreground">Transactions for {format(date, 'PPP')}</p>
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[240px] justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => d && setDate(d)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total In (Receipts)</CardTitle>
                        <ArrowDownCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">+{totals.in.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Out (Payouts/Exp)</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">-{totals.out.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-bold", (totals.in - totals.out) >= 0 ? "text-green-600" : "text-red-600")}>
                            {(totals.in - totals.out).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="h-full flex-1">
                <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>All financial activity for the selected day.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <LoaderCircle className="animate-spin h-8 w-8 text-muted-foreground" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            No transactions found for this date.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-full mt-1", tx.flow === 'In' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                                            {tx.flow === 'In' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{tx.partyName}</p>
                                            <p className="text-xs text-muted-foreground">{tx.type} • {tx.number}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("font-bold text-sm", tx.flow === 'In' ? "text-green-600" : "text-red-600")}>
                                            {tx.flow === 'In' ? '+' : '-'}{tx.amount.toLocaleString()}
                                        </p>
                                        <Badge variant="outline" className="text-[10px] h-5">{tx.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
