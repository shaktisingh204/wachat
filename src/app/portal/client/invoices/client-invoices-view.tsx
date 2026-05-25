'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

import { ClientInvoice } from '@/lib/client-portal/types';
import { Badge } from '@/components/zoruui/badge';
import { Button } from '@/components/zoruui/button';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { EmptyState } from '@/components/zoruui/empty-state';

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

function fmtCurrency(n: number, ccy: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = s.toLowerCase();
    if (v === 'paid') return 'secondary';
    if (v === 'overdue') return 'destructive';
    if (v === 'draft') return 'outline';
    return 'default';
}

interface ClientInvoicesViewProps {
    invoices: ClientInvoice[];
}

export function ClientInvoicesView({ invoices }: ClientInvoicesViewProps) {
    const [filter, setFilter] = React.useState<string>('all');
    
    // Filter invoices
    const filteredInvoices = React.useMemo(() => {
        if (filter === 'all') return invoices;
        if (filter === 'unpaid') return invoices.filter(i => ['Sent', 'Partially Paid'].includes(i.status));
        return invoices.filter(i => i.status.toLowerCase() === filter);
    }, [invoices, filter]);

    // Download CSV
    const handleDownloadCsv = () => {
        const rows = [
            ['Invoice Number', 'Issue Date', 'Due Date', 'Total', 'Paid Amount', 'Currency', 'Status']
        ];
        
        filteredInvoices.forEach(inv => {
            rows.push([
                inv.invoiceNumber,
                inv.invoiceDate || '',
                inv.dueDate || '',
                inv.total.toString(),
                (inv.paidAmount || 0).toString(),
                inv.currency,
                inv.status
            ]);
        });
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `invoices_${filter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate chart data (Spending over time by month)
    const chartData = React.useMemo(() => {
        const months = new Map<string, { month: string, paid: number, total: number, currency: string }>();
        
        // Sort ascending by date
        const sorted = [...invoices].sort((a, b) => {
            if (!a.invoiceDate) return 1;
            if (!b.invoiceDate) return -1;
            return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
        });
        
        for (const inv of sorted) {
            if (!inv.invoiceDate) continue;
            const d = new Date(inv.invoiceDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            
            if (!months.has(key)) {
                months.set(key, { 
                    month: key, 
                    paid: 0, 
                    total: 0,
                    currency: inv.currency || 'USD'
                });
            }
            
            const monthData = months.get(key)!;
            monthData.total += inv.total;
            if (inv.status.toLowerCase() === 'paid') {
                monthData.paid += inv.total;
            } else if (inv.paidAmount) {
                monthData.paid += inv.paidAmount;
            }
        }
        
        return Array.from(months.values());
    }, [invoices]);

    return (
        <div className="flex flex-col gap-6">
            {invoices.length > 0 && chartData.length > 0 && (
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Spending Overview</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis 
                                        stroke="#888888" 
                                        fontSize={12} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickFormatter={(value) => `$${value}`}
                                    />
                                    <Tooltip 
                                        cursor={{fill: 'transparent'}}
                                        formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === 'total' ? 'Invoiced' : 'Paid']}
                                    />
                                    <Legend />
                                    <Bar dataKey="total" name="Invoiced" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="paid" name="Paid" fill="#0f172a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ZoruCardContent>
                </Card>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex gap-2">
                    <Button 
                        variant={filter === 'all' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('all')}
                    >
                        All
                    </Button>
                    <Button 
                        variant={filter === 'paid' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('paid')}
                    >
                        Paid
                    </Button>
                    <Button 
                        variant={filter === 'unpaid' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('unpaid')}
                    >
                        Unpaid
                    </Button>
                    <Button 
                        variant={filter === 'overdue' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setFilter('overdue')}
                    >
                        Overdue
                    </Button>
                </div>

                <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={filteredInvoices.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                </Button>
            </div>

            {filteredInvoices.length === 0 ? (
                <EmptyState
                    title="No invoices found"
                    description="No invoices match the selected filter."
                />
            ) : (
                <Card>
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Number</ZoruTableHead>
                                    <ZoruTableHead>Issue Date</ZoruTableHead>
                                    <ZoruTableHead>Due Date</ZoruTableHead>
                                    <ZoruTableHead>Total</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {filteredInvoices.map((inv) => {
                                    const isUnpaid = ['Sent', 'Overdue', 'Partially Paid'].includes(inv.status);
                                    return (
                                        <ZoruTableRow key={inv._id}>
                                            <ZoruTableCell>
                                                <Link
                                                    href={`/portal/client/invoices/${inv._id}`}
                                                    className="font-medium text-zoru-ink hover:underline"
                                                >
                                                    {inv.invoiceNumber}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(inv.invoiceDate)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(inv.dueDate)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtCurrency(inv.total, inv.currency)}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {isUnpaid && inv.publicHash ? (
                                                    <Button asChild size="sm">
                                                        <a href={`/share/invoice/${inv.publicHash}`}>Pay Now</a>
                                                    </Button>
                                                ) : (
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={`/portal/client/invoices/${inv._id}`}>View</Link>
                                                    </Button>
                                                )}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
                </Card>
            )}
        </div>
    );
}
