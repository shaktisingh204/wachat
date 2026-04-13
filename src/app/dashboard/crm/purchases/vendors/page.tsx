'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Truck, LoaderCircle, Trash2 } from 'lucide-react';
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

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

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
                <LoaderCircle className="h-8 w-8 animate-spin text-clay-ink-muted" />
             </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Vendors"
                subtitle="A list of your suppliers."
                icon={Truck}
                actions={
                    <Link href="/dashboard/crm/purchases/vendors/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Vendor
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">All Vendors</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">A list of your suppliers.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Vendor Name</TableHead>
                                <TableHead className="text-clay-ink-muted">Email</TableHead>
                                <TableHead className="text-clay-ink-muted">Phone</TableHead>
                                <TableHead className="text-clay-ink-muted">Type</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {vendors.length > 0 ? (
                                vendors.map(vendor => (
                                    <TableRow key={vendor._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{vendor.name}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{vendor.email || 'N/A'}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{vendor.phone || 'N/A'}</TableCell>
                                        <TableCell><ClayBadge tone="rose-soft" className="capitalize">{vendor.vendorType}</ClayBadge></TableCell>
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
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No vendors have been added yet.
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
