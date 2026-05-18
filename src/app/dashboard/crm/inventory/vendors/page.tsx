'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Plus, LoaderCircle, Trash2 } from "lucide-react";
import Link from 'next/link';
import { getCrmVendors, deleteCrmVendor } from '@/app/actions/crm-vendors.actions';
import type { WithId, CrmVendor } from '@/lib/definitions';

import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function VendorsPage() {
    const [vendors, setVendors] = useState<WithId<CrmVendor>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useZoruToast();

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
        <EntityListShell
            title="Vendors"
            subtitle="A list of your suppliers."
            primaryAction={
                <Link href="/dashboard/crm/purchases/vendors/new">
                    <ZoruButton>
                        New Vendor
                    </ZoruButton>
                </Link>
            }
        >

            <ZoruCard>
                <h2 className="text-[16px] font-semibold text-foreground">All Vendors</h2>
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Vendor Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Email</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Phone</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {vendors.length > 0 ? (
                                vendors.map(vendor => (
                                    <ZoruTableRow key={vendor._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{vendor.name}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{vendor.email || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{vendor.phone || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant="ghost" className="capitalize">{vendor.vendorType}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruAlertDialog>
                                                <ZoruAlertDialogTrigger asChild>
                                                    <ZoruButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton>
                                                </ZoruAlertDialogTrigger>
                                                <ZoruAlertDialogContent>
                                                    <ZoruAlertDialogHeader>
                                                        <ZoruAlertDialogTitle>Delete Vendor?</ZoruAlertDialogTitle>
                                                        <ZoruAlertDialogDescription>Are you sure you want to delete {vendor.name}?</ZoruAlertDialogDescription>
                                                    </ZoruAlertDialogHeader>
                                                    <ZoruAlertDialogFooter>
                                                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                        <ZoruAlertDialogAction onClick={() => handleDelete(vendor._id.toString())}>Delete</ZoruAlertDialogAction>
                                                    </ZoruAlertDialogFooter>
                                                </ZoruAlertDialogContent>
                                            </ZoruAlertDialog>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No vendors have been added yet.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    )
}
