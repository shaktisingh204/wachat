'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, SlidersHorizontal, Trash2, ChevronDown } from 'lucide-react';
import Link from "next/link";
import { useParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useState } from "react";


export default function VoucherBookDetailPage() {
    const params = useParams();
    const voucherBookId = params.voucherBookId as string;
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

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
                        <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download CSV</Button>
                    </div>
                </div>
            </div>

             <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold">Filters</h3>
                         <div className="flex items-center gap-2 text-sm mt-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline"><SlidersHorizontal className="mr-2 h-4 w-4" />More Filters</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Start Date</Label>
                                        <DatePicker date={startDate} setDate={setStartDate} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date</Label>
                                        <DatePicker date={endDate} setDate={setEndDate} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reversed</Label>
                                         <Select defaultValue="no">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="no">No</SelectItem>
                                                <SelectItem value="yes">Yes</SelectItem>
                                                <SelectItem value="all">All</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button>Apply</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <Button variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Clear All Filters</Button>
                        </div>
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
    
