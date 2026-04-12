'use server';

import { Suspense } from 'react';
import { getDebitNotes } from '@/app/actions/crm-debit-notes.actions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Repeat } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
// import { Pagination } from '@/components/ui/pagination';
const Pagination: any = () => null;

export default async function DebitNotesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const { notes, total } = await getDebitNotes(currentPage, 20, query);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Debit Notes</h1>
                    <p className="text-muted-foreground">Manage vendor returns and adjustments.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/purchases/debit-notes/new">
                        <Plus className="mr-2 h-4 w-4" /> New Debit Note
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Debit Notes</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search debit notes..."
                                className="pl-8"
                                defaultValue={query}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Note #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {notes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No debit notes found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    notes.map((note) => (
                                        <TableRow key={note._id.toString()}>
                                            <TableCell className="font-medium">{note.noteNumber}</TableCell>
                                            <TableCell>{format(new Date(note.noteDate), 'PP')}</TableCell>
                                            <TableCell>
                                                <span className="text-muted-foreground italic">Vendor {note.vendorId.toString().slice(-4)}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={note.status === 'Applied' ? 'default' : 'secondary'}>
                                                    {note.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={note.reason}>
                                                {note.reason || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {note.currency} {note.total.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/crm/purchases/debit-notes/${note._id}`}>View</Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div className="text-xs text-muted-foreground">
                        Showing {notes.length} of {total} notes
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
