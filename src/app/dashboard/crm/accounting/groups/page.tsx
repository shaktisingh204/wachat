'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { getCrmAccountGroups, saveCrmAccountGroup, deleteCrmAccountGroup } from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoaderCircle, Plus, Trash2, Edit, Download, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Papa from 'papaparse';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const saveInitialState = { message: null, error: null };

const accountTypes = ['Asset', 'Liability', 'Income', 'Expense', 'Capital'];

const categoryMap: Record<string, string[]> = {
    Asset: ['FDR', 'Bank_Accounts', 'Cash_In_Hand', 'Loans_and_Advances', 'Accounts_receivable_(Sundry_Debtors)', 'TDS', 'Deposits', 'Stock_In_Hand', 'Security', 'Machinery', 'Land', 'Vehicle', 'Current_Assets', 'Fixed_Assets', 'Buildings'],
    Liability: ['Bank_OD_A/c', 'Branch_/_Divisions', 'Current_Liabilities', 'Duties_and_Taxes', 'Loans', 'Provisions', 'Reserves_and_Surplus', 'Secured_Loans', 'Accounts_Payable_(Sundry_Creditors)', 'Suspense_A/c', 'Unsecured_Loans', 'Legal_HR_Expenses'],
    Income: ['Direct_Incomes', 'Indirect_Incomes', 'Sales_Accounts'],
    Expense: ['Administrative_Expenses', 'Depreciation_Expenses', 'Direct_Expenses', 'Employees_Cost', 'Financial_Expenses', 'Indirect_Expenses', 'Misc_Expenses', 'Promotional_Expenses', 'Purchase_Accounts', 'Cost_Of_Goods_Sold'],
    Capital: ['Capital_Accounts', 'Equities'],
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save Changes' : 'Submit'}
        </Button>
    )
}

function AccountGroupDialog({ 
    isOpen, 
    onOpenChange, 
    onSave, 
    initialData 
}: { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void;
    onSave: () => void; 
    initialData: WithId<CrmAccountGroup> | null 
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCrmAccountGroup, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [selectedType, setSelectedType] = useState(initialData?.type || '');

    useEffect(() => {
        setSelectedType(initialData?.type || '');
    }, [initialData]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <form action={formAction} ref={formRef}>
                    {isEditing && <input type="hidden" name="groupId" value={initialData?._id.toString()} />}
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit' : 'Create New'} Account Group</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Account Group Name *</Label>
                            <Input id="name" name="name" placeholder="Type Account Group Name" required defaultValue={initialData?.name} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select name="type" required onValueChange={setSelectedType} defaultValue={initialData?.type}>
                                <SelectTrigger><SelectValue placeholder="Select a type..."/></SelectTrigger>
                                <SelectContent>
                                    {accountTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         {selectedType && categoryMap[selectedType] && (
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select name="category" required defaultValue={initialData?.category}>
                                    <SelectTrigger><SelectValue placeholder="Select a category..."/></SelectTrigger>
                                    <SelectContent>
                                        {categoryMap[selectedType].map(cat => <SelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function AccountGroupsPage() {
    const [groups, setGroups] = useState<WithId<CrmAccountGroup>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();
    const [editingGroup, setEditingGroup] = useState<WithId<CrmAccountGroup> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmAccountGroups();
            setGroups(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (groupId: string) => {
        const result = await deleteCrmAccountGroup(groupId);
        if (result.success) {
            toast({ title: 'Success', description: 'Account group deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    const handleOpenDialog = (group: WithId<CrmAccountGroup> | null) => {
        setEditingGroup(group);
        setIsDialogOpen(true);
    };
    
    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (format === 'csv') {
            const csv = Papa.unparse(groups.map(({ name, type, category }) => ({ Name: name, Type: type, Category: category.replace(/_/g, ' ') })));
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'account-groups.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

    return (
        <>
            <AccountGroupDialog 
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={fetchData}
                initialData={editingGroup}
            />
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Account Groups</h1>
                    <p className="text-muted-foreground">A list of all account groups in your CRM.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={() => handleOpenDialog(null)}><Plus className="mr-2 h-4 w-4" /> New Account Group</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download As<ChevronDown className="ml-2 h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem disabled onSelect={() => handleDownload('xls')}>XLS</DropdownMenuItem>
                            <DropdownMenuItem disabled onSelect={() => handleDownload('pdf')}>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Group Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : groups.length > 0 ? (
                                    groups.map(group => (
                                        <TableRow key={group._id.toString()}>
                                            <TableCell className="font-medium">{group.name}</TableCell>
                                            <TableCell>{group.type}</TableCell>
                                            <TableCell>{group.category?.replace(/_/g, ' ')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(group)}><Edit className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Delete Group?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete the "{group.name}" group?</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(group._id.toString())}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No account groups found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
