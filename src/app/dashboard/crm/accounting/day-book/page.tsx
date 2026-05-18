'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruPopover, ZoruPopoverContent, ZoruPopoverTrigger } from '@/components/zoruui';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowDownCircle, ArrowUpCircle, BookOpen, LoaderCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Calendar } from '@/components/ui/calendar';

import { getDayBookTransactions, type DayBookTransaction } from "@/app/actions/crm-accounting-reports.actions";

import { CrmPageHeader } from '../../_components/crm-page-header';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Day Book"
                subtitle={`Transactions for ${format(date, 'PPP')}`}
                icon={BookOpen}
                actions={
                    <ZoruPopover>
                        <ZoruPopoverTrigger asChild>
                            <ZoruButton
                                variant="outline"
                               
                            >
                                {date ? format(date, "PPP") : 'Pick a date'}
                            </ZoruButton>
                        </ZoruPopoverTrigger>
                        <ZoruPopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={(d) => d && setDate(d)}
                                initialFocus
                            />
                        </ZoruPopoverContent>
                    </ZoruPopover>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ZoruCard>
                    <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-medium text-muted-foreground">Total In (Receipts)</p>
                        <ArrowDownCircle className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-[24px] font-semibold text-emerald-500">+{totals.in.toLocaleString()}</div>
                </ZoruCard>
                <ZoruCard>
                    <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-medium text-muted-foreground">Total Out (Payouts/Exp)</p>
                        <ArrowUpCircle className="h-4 w-4 text-destructive" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-[24px] font-semibold text-destructive">-{totals.out.toLocaleString()}</div>
                </ZoruCard>
                <ZoruCard>
                    <p className="text-[12.5px] font-medium text-muted-foreground">Net Cash Flow</p>
                    <div className={cn("mt-2 text-[24px] font-semibold", (totals.in - totals.out) >= 0 ? "text-emerald-500" : "text-destructive")}>
                        {(totals.in - totals.out).toLocaleString()}
                    </div>
                </ZoruCard>
            </div>

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">Transactions</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">All financial activity for the selected day.</p>
                <div className="mt-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <LoaderCircle className="animate-spin h-8 w-8 text-muted-foreground" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-10 text-[13px] text-muted-foreground">
                            No transactions found for this date.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-full mt-1", tx.flow === 'In' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-destructive")}>
                                            {tx.flow === 'In' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-medium text-foreground">{tx.partyName}</p>
                                            <p className="text-[11.5px] text-muted-foreground">{tx.type} • {tx.number}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("font-semibold text-[13px]", tx.flow === 'In' ? "text-emerald-500" : "text-destructive")}>
                                            {tx.flow === 'In' ? '+' : '-'}{tx.amount.toLocaleString()}
                                        </p>
                                        <ZoruBadge variant="ghost" className="mt-1">{tx.status}</ZoruBadge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ZoruCard>
        </div>
    )
}
