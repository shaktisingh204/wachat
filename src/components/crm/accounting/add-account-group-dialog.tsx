'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { saveCrmAccountGroup } from '@/app/actions/crm-accounting.actions';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { ClayButton } from '@/components/clay';

const initialState = {
    message: '',
    error: ''
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Group
        </ClayButton>
    );
}

interface AddAccountGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGroupAdded: (group?: any) => void;
    defaultName?: string;
}

export function AddAccountGroupDialog({ open, onOpenChange, onGroupAdded, defaultName = '' }: AddAccountGroupDialogProps) {
    const [formState, formAction] = useActionState(saveCrmAccountGroup, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    // Categories mapping based on type
    const categoriesByType: Record<string, string[]> = {
        'Asset': ['Current_Assets', 'Fixed_Assets', 'Investments', 'Loans_and_Advances', 'Misc_Expenses'],
        'Liability': ['Current_Liabilities', 'Long_Term_Liabilities', 'Loans', 'Diff_In_Opening_Balances'],
        'Income': ['Direct_Incomes', 'Indirect_Incomes', 'Sales_Accounts'],
        'Expense': ['Direct_Expenses', 'Indirect_Expenses', 'Purchase_Accounts', 'Cost_Of_Goods_Sold'],
        'Capital': ['Capital_Account', 'Reserves_and_Surplus']
    };

    const [selectedType, setSelectedType] = useState<string>('Asset');

    useEffect(() => {
        if (formState.message) {
            toast({ title: 'Success!', description: formState.message });
            // We need to fetch the newly created group to pass it back, or just trigger a refresh
            // Ideally the action returns the object, but here it returns message. 
            // We will just pass a signal to refresh.
            onGroupAdded();
            formRef.current?.reset();
        }
        if (formState.error) {
            toast({ title: 'Error', description: formState.error, variant: 'destructive' });
        }
    }, [formState, toast, onGroupAdded]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-clay-ink">Add Account Group</DialogTitle>
                    <DialogDescription className="text-clay-ink-muted">
                        Create a new group for your Chart of Accounts.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-clay-ink">Group Name</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="type" className="text-clay-ink">Type</Label>
                        <Select name="type" required value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Asset">Asset</SelectItem>
                                <SelectItem value="Liability">Liability</SelectItem>
                                <SelectItem value="Income">Income</SelectItem>
                                <SelectItem value="Expense">Expense</SelectItem>
                                <SelectItem value="Capital">Capital</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="category" className="text-clay-ink">Category</Label>
                        <Select name="category" required>
                            <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                            <SelectContent>
                                {categoriesByType[selectedType]?.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <ClayButton type="button" variant="pill" onClick={() => onOpenChange(false)}>Cancel</ClayButton>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
