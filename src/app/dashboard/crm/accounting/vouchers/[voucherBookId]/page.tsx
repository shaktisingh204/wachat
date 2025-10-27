
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from "next/link";
import { useParams } from "next/navigation";

export default function VoucherBookDetailPage() {
    const params = useParams();
    const voucherBookId = params.voucherBookId as string;

    // In a real application, you would fetch the voucher book details using the ID
    const mockVoucherBook = {
        name: "Debit Note Voucher Book",
        type: "Debit Note"
    };

    return (
        <div className="space-y-6">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/accounting/vouchers"><ArrowLeft className="mr-2 h-4 w-4" />Back to Voucher Books</Link>
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{mockVoucherBook.name}</h1>
                        <p className="text-muted-foreground">Voucher Book Type: {mockVoucherBook.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
            </div>

             <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold">Filters</h3>
                         <div className="flex items-center gap-2 text-sm mt-2">
                            <Select defaultValue="no">
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no">Reversed: No</SelectItem>
                                    <SelectItem value="yes">Reversed: Yes</SelectItem>
                                    <SelectItem value="all">Reversed: All</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />More Filters</Button>
                            <Button variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Clear All Filters</Button>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground self-end">
                        <span>Applied Filters:</span>
                        <span>None</span>
                    </div>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                         <CardTitle>Voucher Entries (0 Found)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Voucher Number</TableHead>
                                    <TableHead>Voucher Date</TableHead>
                                    <TableHead>Reversed</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No Data
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 <CardFooter>
                     <p className="text-sm text-muted-foreground">No Voucher Entry Found</p>
                </CardFooter>
            </Card>
        </div>
    );
}
    
