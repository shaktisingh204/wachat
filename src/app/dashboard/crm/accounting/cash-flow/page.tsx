

export const dynamic = 'force-dynamic';

import { getCashFlowStatement } from '@/app/actions/crm-accounting-reports.actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpCircle, ArrowDownCircle, Banknote } from 'lucide-react';

export default async function CashFlowPage({ searchParams }: { searchParams: { year?: string } }) {
    const year = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
    const { monthly, totalIn, totalOut } = await getCashFlowStatement(year);
    const netCashFlow = totalIn - totalOut;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                        <Banknote className="h-8 w-8 text-primary" />
                        Cash Flow Statement
                    </h1>
                    <p className="text-muted-foreground">Inflow vs Outflow Analysis for {year}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2 text-green-600">
                            <ArrowUpCircle className="h-5 w-5" />
                            ₹{totalIn.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2 text-red-600">
                            <ArrowDownCircle className="h-5 w-5" />
                            ₹{totalOut.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${netCashFlow >= 0 ? 'text-primary' : 'text-red-500'}`}>
                            ₹{netCashFlow.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly Breakdown</CardTitle>
                    <CardDescription>Detailed view of cash movement by month.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right text-green-600">Inflow</TableHead>
                                    <TableHead className="text-right text-red-600">Outflow</TableHead>
                                    <TableHead className="text-right">Net Change</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthly.map((m) => (
                                    <TableRow key={m.month}>
                                        <TableCell className="font-medium">{m.month}</TableCell>
                                        <TableCell className="text-right">₹{m.inflow.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₹{m.outflow.toLocaleString()}</TableCell>
                                        <TableCell className={`text-right font-bold ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{m.net.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
