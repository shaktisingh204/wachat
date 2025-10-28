
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, LoaderCircle, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getCrmWarehouses, saveCrmWarehouse, deleteCrmWarehouse } from '@/app/actions/crm-warehouses.actions';
import type { WithId, CrmWarehouse } from '@/lib/definitions';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const saveInitialState = { message: null, error: null };

function SaveWarehouseButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Save Warehouse
        </Button>
    )
}

function WarehouseDialog({ onSave }: { onSave: () => void }) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(saveCrmWarehouse, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if(state.message) {
            toast({ title: 'Success!', description: state.message });
            onSave();
            setOpen(false);
        }
        if(state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive'});
        }
    }, [state, toast, onSave]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Warehouse</Button></DialogTrigger>
            <DialogContent>
                 <form action={formAction} ref={formRef}>
                    <DialogHeader>
                        <DialogTitle>New Warehouse</DialogTitle>
                        <DialogDescription>Add a new location to track your stock.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="name">Warehouse Name</Label><Input id="name" name="name" required /></div>
                        <div className="space-y-2"><Label htmlFor="location">Location</Label><Input id="location" name="location" /></div>
                        <div className="flex items-center space-x-2"><Switch id="isDefault" name="isDefault" /><Label htmlFor="isDefault">Make this the default warehouse</Label></div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SaveWarehouseButton/>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<WithId<CrmWarehouse>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmWarehouses();
            setWarehouses(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (id: string) => {
        const result = await deleteCrmWarehouse(id);
        if (result.success) {
            toast({ title: 'Success', description: 'Warehouse deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Warehouses</h2>
                <WarehouseDialog onSave={fetchData} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Warehouses</CardTitle>
                    <CardDescription>A list of all your stock locations.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Is Default</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center h-24"><LoaderCircle className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                            ) : warehouses.length > 0 ? (
                                warehouses.map(wh => (
                                    <TableRow key={wh._id.toString()}>
                                        <TableCell className="font-medium">{wh.name}</TableCell>
                                        <TableCell>{wh.location || 'N/A'}</TableCell>
                                        <TableCell>{wh.isDefault && <CheckCircle className="h-5 w-5 text-primary" />}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={wh.isDefault}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will delete the warehouse "{wh.name}". You cannot delete a warehouse that has stock.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(wh._id.toString())}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        No warehouses have been added yet.
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
