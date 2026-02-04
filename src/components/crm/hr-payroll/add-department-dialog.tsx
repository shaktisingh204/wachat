'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
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
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmDepartment } from '@/app/actions/crm-employees.actions';

const initialState: { message?: string; error?: string; newDepartment?: any } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Department
        </Button>
    );
}

interface AddDepartmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDepartmentAdded: (department: any) => void;
    defaultName?: string;
}

export function AddDepartmentDialog({ open, onOpenChange, onDepartmentAdded, defaultName = '' }: AddDepartmentDialogProps) {
    const [state, formAction] = useActionState(saveCrmDepartment, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            // Pass the new department back. 
            // NOTE: The server action needs to be updated to return `newDepartment`.
            if (state.newDepartment) {
                onDepartmentAdded(state.newDepartment);
            } else {
                // Fallback if action not updated yet (though I will update it)
                onOpenChange(false);
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onDepartmentAdded]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Department</DialogTitle>
                    <DialogDescription>
                        Create a new department for your organization.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Department Name</Label>
                        <Input id="name" name="name" defaultValue={defaultName} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" name="description" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
