'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from "@/components/ui/badge";
import { Download, MoreVertical, Edit, FilePlus, Eye, LoaderCircle, ChevronDown, PlusCircle } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import { CreateVoucherBookDialog } from '@/components/wabasimplify/create-voucher-book-dialog';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { CrmVoucherBook } from '@/lib/definitions';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';

export default function VoucherBooksPage() {
    const [books, setBooks] = useState<WithId<CrmVoucherBook>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();
    const [financialYear, setFinancialYear] = useState('fy2526');

    const fetchBooks = useCallback(() => {
        startTransition(async () => {
            const data = await getVoucherBooks();
            setBooks(data);
        });
    }, []);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);
    
    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (format === 'csv') {
            const csv = Papa.unparse(books.map(book => ({
                "Voucher Book": book.name,
                "Type": book.type,
                "Entries": book.entryCount || 0,
                "Last Entry Date": book.lastEntryDate ? new Date(book.lastEntryDate).toLocaleDateString() : 'N/A'
            })));
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'voucher-books.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.` });
        }
    };


    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Voucher Books</h1>
                    <p className="text-muted-foreground">Manage your accounting voucher books.</p>
                </div>
                 <div className="flex items-center gap-2">
                     <CreateVoucherBookDialog onSave={fetchBooks} />
                     <Select value={financialYear} onValueChange={setFinancialYear}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                            <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                        </SelectContent>
                    </Select>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download As<ChevronDown className="ml-2 h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                            <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Voucher Book</TableHead>
                                    <TableHead>Voucher Book Type</TableHead>
                                    <TableHead>Entries</TableHead>
                                    <TableHead>Reversed Entries</TableHead>
                                    <TableHead>Last Entry Date</TableHead>
                                    <TableHead>Is Default</TableHead>
                                    <TableHead>Created By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="text-center h-24"><LoaderCircle className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : books.length > 0 ? (
                                    books.map(book => (
                                        <TableRow key={book._id.toString()}>
                                            <TableCell className="font-medium">{book.name}</TableCell>
                                            <TableCell><Badge variant="outline">{book.type}</Badge></TableCell>
                                            <TableCell>{book.entryCount || 0}</TableCell>
                                            <TableCell>0</TableCell>
                                            <TableCell>{book.lastEntryDate ? new Date(book.lastEntryDate).toLocaleDateString() : '-'}</TableCell>
                                            <TableCell>
                                                {book.isDefault ? <CheckCircle className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                                            </TableCell>
                                            <TableCell>System</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end items-center gap-1">
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={`/dashboard/crm/accounting/vouchers/${book._id.toString()}`}>Open</Link>
                                                    </Button>
                                                    <Button asChild variant="default" size="sm">
                                                        <Link href="/dashboard/crm/accounting/vouchers/new">New Entry</Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No voucher books found. Create one to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
