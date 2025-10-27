
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Download, SlidersHorizontal, MoreVertical, Edit, FilePlus, Eye } from 'lucide-react';
import { CheckCircle, XCircle } from 'lucide-react';
import { CreateVoucherBookDialog } from '@/components/wabasimplify/create-voucher-book-dialog';
import Link from 'next/link';

const mockVoucherBooks = [
  {
    id: '1',
    name: 'Debit Note Voucher Book',
    type: 'Debit Note',
    entries: 0,
    reversedEntries: 0,
    lastEntryDate: null,
    isDefault: true,
    createdBy: 'Waplia Digital Solutions',
  },
  {
    id: '2',
    name: 'Sales Voucher Book',
    type: 'Sales',
    entries: 15,
    reversedEntries: 1,
    lastEntryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isDefault: false,
    createdBy: 'Waplia Digital Solutions',
  },
];

export default function VoucherBooksPage() {
    const [page, setPage] = useState(1);
    const total = 12;

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
                             <CreateVoucherBookDialog />
                             <Select defaultValue="fy2526">
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fy2526">FY 2025-2026</SelectItem>
                                    <SelectItem value="fy2425">FY 2024-2025</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />Show/Hide Columns</Button>
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
                                {mockVoucherBooks.map(book => (
                                    <TableRow key={book.id}>
                                        <TableCell className="font-medium">{book.name}</TableCell>
                                        <TableCell><Badge variant="outline">{book.type}</Badge></TableCell>
                                        <TableCell>{book.entries}</TableCell>
                                        <TableCell>{book.reversedEntries}</TableCell>
                                        <TableCell>{book.lastEntryDate ? new Date(book.lastEntryDate).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>
                                            {book.isDefault ? <CheckCircle className="h-5 w-5 text-primary" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                                        </TableCell>
                                        <TableCell>{book.createdBy}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                <Button asChild variant="ghost" size="sm">
                                                    <Link href={`/dashboard/crm/accounting/vouchers/${book.id}`}>Open</Link>
                                                </Button>
                                                <Button variant="ghost" size="sm">Edit</Button>
                                                <Button asChild variant="default" size="sm">
                                                    <Link href="/dashboard/crm/accounting/vouchers/new">New Entry</Link>
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                                                    </DropdownMenuTrigger>
                                                     <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>View Entries</DropdownMenuItem>
                                                        <DropdownMenuItem>Settings</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Showing <strong>1</strong> to <strong>10</strong> of <strong>{total}</strong> Voucher Books</p>
                    <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" disabled>Previous</Button>
                         <Button variant="outline" size="sm">Next</Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
