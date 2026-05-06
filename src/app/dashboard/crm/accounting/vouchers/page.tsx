'use client';
import { ZoruBadge, ZoruButton, ZoruCard, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast } from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';

import { Download, LoaderCircle, ChevronDown, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { CreateVoucherBookDialog } from '@/components/wabasimplify/create-voucher-book-dialog';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { CrmVoucherBook } from '@/lib/definitions';
import Papa from 'papaparse';

import { CrmPageHeader } from '../../_components/crm-page-header';

export default function VoucherBooksPage() {
    const [books, setBooks] = useState<WithId<CrmVoucherBook>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();
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
                        <ZoruSelect value={financialYear} onValueChange={setFinancialYear}>
                            <ZoruSelectTrigger className="w-[180px]"><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="fy2526">FY 2025-2026</ZoruSelectItem>
                                <ZoruSelectItem value="fy2425">FY 2024-2025</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="outline">
                                    Download As
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent>
                                <ZoruDropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem disabled>XLS</ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem disabled>PDF</ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                    </div>
                }
            />
            <ZoruCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Voucher Book</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Voucher Book Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Entries</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reversed Entries</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Last Entry Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Is Default</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Created By</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={8} className="text-center h-24"><LoaderCircle className="h-6 w-6 animate-spin mx-auto text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                            ) : books.length > 0 ? (
                                books.map(book => (
                                    <ZoruTableRow key={book._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{book.name}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant="ghost">{book.type}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{book.entryCount || 0}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">0</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{book.lastEntryDate ? new Date(book.lastEntryDate).toLocaleDateString() : '-'}</ZoruTableCell>
                                        <ZoruTableCell>
                                            {book.isDefault ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">System</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                <ZoruButton asChild variant="ghost" size="sm">
                                                    <Link href={`/dashboard/crm/accounting/vouchers/${book._id.toString()}`}>Open</Link>
                                                </ZoruButton>
                                                <ZoruButton asChild variant="default" size="sm">
                                                    <Link href="/dashboard/crm/accounting/vouchers/new">New Entry</Link>
                                                </ZoruButton>
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                 <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No voucher books found. Create one to get started.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    )
}
