'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowDownCircle, ArrowUpCircle, BookOpen, LoaderCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getDayBookTransactions, type DayBookTransaction } from "@/app/actions/crm-accounting-reports.actions";

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
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
                    <Popover>
                        <PopoverTrigger asChild>
                            <ClayButton
                                variant="pill"
                                leading={<CalendarIcon className="h-4 w-4" strokeWidth={1.75} />}
                            >
                                {date ? format(date, "PPP") : 'Pick a date'}
                            </ClayButton>
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
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <ClayCard>
                    <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-medium text-clay-ink-muted">Total In (Receipts)</p>
                        <ArrowDownCircle className="h-4 w-4 text-clay-green" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-[24px] font-semibold text-clay-green">+{totals.in.toLocaleString()}</div>
                </ClayCard>
                <ClayCard>
                    <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-medium text-clay-ink-muted">Total Out (Payouts/Exp)</p>
                        <ArrowUpCircle className="h-4 w-4 text-clay-red" strokeWidth={1.75} />
                    </div>
                    <div className="mt-2 text-[24px] font-semibold text-clay-red">-{totals.out.toLocaleString()}</div>
                </ClayCard>
                <ClayCard>
                    <p className="text-[12.5px] font-medium text-clay-ink-muted">Net Cash Flow</p>
                    <div className={cn("mt-2 text-[24px] font-semibold", (totals.in - totals.out) >= 0 ? "text-clay-green" : "text-clay-red")}>
                        {(totals.in - totals.out).toLocaleString()}
                    </div>
                </ClayCard>
            </div>

            <ClayCard>
                <h2 className="text-[16px] font-semibold text-clay-ink">Transactions</h2>
                <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">All financial activity for the selected day.</p>
                <div className="mt-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <LoaderCircle className="animate-spin h-8 w-8 text-clay-ink-muted" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-10 text-[13px] text-clay-ink-muted">
                            No transactions found for this date.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between border-b border-clay-border pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-full mt-1", tx.flow === 'In' ? "bg-clay-green-soft text-clay-green" : "bg-clay-red-soft text-clay-red")}>
                                            {tx.flow === 'In' ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-medium text-clay-ink">{tx.partyName}</p>
                                            <p className="text-[11.5px] text-clay-ink-muted">{tx.type} • {tx.number}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("font-semibold text-[13px]", tx.flow === 'In' ? "text-clay-green" : "text-clay-red")}>
                                            {tx.flow === 'In' ? '+' : '-'}{tx.amount.toLocaleString()}
                                        </p>
                                        <ClayBadge tone="neutral" className="mt-1">{tx.status}</ClayBadge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </ClayCard>
        </div>
    )
}
