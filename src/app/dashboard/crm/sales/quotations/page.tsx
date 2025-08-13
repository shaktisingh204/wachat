
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, LoaderCircle } from 'lucide-react';
import { getQuotations } from '@/app/actions/crm-quotations.actions';
import type { WithId } from 'mongodb';

// Placeholder type, will be defined properly later
type CrmQuotation = any;

export default function QuotationsPage() {
    const [quotations, setQuotations] = useState<WithId<CrmQuotation>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getQuotations();
            setQuotations(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileText className="h-8 w-8" />
                        Quotations & Estimates
                    </h1>
                    <p className="text-muted-foreground">Create and manage your sales quotations.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Quotation
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Quotations</CardTitle>
                    <CardDescription>A list of quotations you have created.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Quotation #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : quotations.length > 0 ? (
                                    // This part will be populated later
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            Data will be shown here.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No quotations found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
