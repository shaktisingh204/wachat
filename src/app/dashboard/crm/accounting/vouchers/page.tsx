
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Download, MoreVertical, Edit, FilePlus, Eye, LoaderCircle } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import { CreateVoucherBookDialog } from '@/components/wabasimplify/create-voucher-book-dialog';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getVoucherBooks } from '@/app/actions/crm-vouchers.actions';
import type { CrmVoucherBook } from '@/lib/definitions';

export default function VoucherBooksPage() {
    const [books, setBooks] = useState<WithId<CrmVoucherBook>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchBooks = useCallback(() => {
        startTransition(async () => {
            const data = await getVoucherBooks();
            setBooks(data);
        });
    }, []);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);


    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <CardTitle>Voucher Books</CardTitle>
                            <CardDescription>Manage your accounting voucher books.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <CreateVoucherBookDialog onSave={fetchBooks} />
                             <Select defaultValue="fy2526">
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                    <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
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
