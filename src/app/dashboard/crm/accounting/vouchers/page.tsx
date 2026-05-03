'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, LoaderCircle, ChevronDown, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { CreateVoucherBookDialog } from '@/components/wabasimplify/create-voucher-book-dialog';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { CrmVoucherBook } from '@/lib/definitions';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Voucher Books"
                subtitle="Manage your accounting voucher books."
                icon={Receipt}
                actions={
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
                            <DropdownMenuTrigger asChild>
                                <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} trailing={<ChevronDown className="h-4 w-4" strokeWidth={1.75} />}>
                                    Download As
                                </ClayButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                                <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                                <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                }
            />
            <ClayCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Voucher Book</TableHead>
                                <TableHead className="text-muted-foreground">Voucher Book Type</TableHead>
                                <TableHead className="text-muted-foreground">Entries</TableHead>
                                <TableHead className="text-muted-foreground">Reversed Entries</TableHead>
                                <TableHead className="text-muted-foreground">Last Entry Date</TableHead>
                                <TableHead className="text-muted-foreground">Is Default</TableHead>
                                <TableHead className="text-muted-foreground">Created By</TableHead>
                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-border"><TableCell colSpan={8} className="text-center h-24"><LoaderCircle className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></TableCell></TableRow>
                            ) : books.length > 0 ? (
                                books.map(book => (
                                    <TableRow key={book._id.toString()} className="border-border">
                                        <TableCell className="font-medium text-foreground">{book.name}</TableCell>
                                        <TableCell><ClayBadge tone="neutral">{book.type}</ClayBadge></TableCell>
                                        <TableCell className="text-foreground">{book.entryCount || 0}</TableCell>
                                        <TableCell className="text-foreground">0</TableCell>
                                        <TableCell className="text-foreground">{book.lastEntryDate ? new Date(book.lastEntryDate).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>
                                            {book.isDefault ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                                        </TableCell>
                                        <TableCell className="text-foreground">System</TableCell>
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
                                 <TableRow className="border-border">
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No voucher books found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    )
}
