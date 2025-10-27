'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { saveCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import type { CrmChartOfAccount, CrmAccountGroup } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LoaderCircle, Save } from 'lucide-react';

const saveInitialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
            {isEditing ? 'Save Changes' : 'Create Account'}
        </Button>
    )
}

interface CrmChartOfAccountDialogProps { 
    isOpen: boolean; 
    onOpenChange: (open: boolean) => void;
    onSave: () => void; 
    accountGroups: WithId<CrmAccountGroup>[];
    initialData: WithId<CrmChartOfAccount> | null 
}

export function CrmChartOfAccountDialog({ isOpen, onOpenChange, onSave, accountGroups, initialData }: CrmChartOfAccountDialogProps) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCrmChartOfAccount, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

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
                    {isEditing && <input type="hidden" name="accountId" value={initialData?._id.toString()} />}
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit' : 'Create New'} Account</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Account Name *</Label>
                            <Input id="name" name="name" placeholder="e.g. Sales Revenue" required defaultValue={initialData?.name} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountGroupId">Account Group *</Label>
                             <Select name="accountGroupId" required defaultValue={initialData?.accountGroupId.toString()}>
                                <SelectTrigger><SelectValue placeholder="Select a group..."/></SelectTrigger>
                                <SelectContent>
                                    {accountGroups.map(group => <SelectItem key={group._id.toString()} value={group._id.toString()}>{group.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="openingBalance">Opening Balance *</Label>
                                <Input id="openingBalance" name="openingBalance" type="number" step="0.01" required defaultValue={initialData?.openingBalance || 0} />
                            </div>
                             <div className="space-y-2">
                                <Label>Balance Type *</Label>
                                <div className="grid grid-cols-2 gap-2">
                                     <Select name="balanceType" defaultValue={initialData?.balanceType || "Dr"}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Dr">Dr (Debit)</SelectItem>
                                            <SelectItem value="Cr">Cr (Credit)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select name="currency" defaultValue={initialData?.currency || "INR"}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INR">INR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea id="description" name="description" defaultValue={initialData?.description} />
                        </div>
                         <div className="flex items-center space-x-2 pt-2">
                            <Switch id="status" name="status" defaultChecked={initialData?.status === 'Active' || !isEditing} />
                            <Label htmlFor="status">Set as Active</Label>
                        </div>
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
