
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, LoaderCircle, Edit, Trash2 } from "lucide-react";
import Link from 'next/link';
import { getCrmVendors, deleteCrmVendor } from '@/app/actions/crm-vendors.actions';
import type { WithId, CrmVendor } from '@/lib/definitions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export default function VendorsPage() {
    const [vendors, setVendors] = useState<WithId<CrmVendor>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmVendors();
            setVendors(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleDelete = async (vendorId: string) => {
        startTransition(async () => {
            const result = await deleteCrmVendor(vendorId);
            if(result.success) {
                toast({ title: 'Success', description: 'Vendor deleted.' });
                fetchData();
            } else {
                 toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    if (isLoading && vendors.length === 0) {
        return (
             <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Vendors</h2>
                 <Button asChild>
                    <Link href="/dashboard/crm/purchases/vendors/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Vendor
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Vendors</CardTitle>
                    <CardDescription>A list of your suppliers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vendor Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {vendors.length > 0 ? (
                                vendors.map(vendor => (
                                    <TableRow key={vendor._id.toString()}>
                                        <TableCell className="font-medium">{vendor.name}</TableCell>
                                        <TableCell>{vendor.email || 'N/A'}</TableCell>
                                        <TableCell>{vendor.phone || 'N/A'}</TableCell>
                                        <TableCell><Badge variant="outline" className="capitalize">{vendor.vendorType}</Badge></TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Vendor?</AlertDialogTitle>
                                                        <AlertDialogDescription>Are you sure you want to delete {vendor.name}?</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(vendor._id.toString())}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        No vendors have been added yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
