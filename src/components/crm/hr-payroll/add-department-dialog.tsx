'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Input,
  Label,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmDepartment } from '@/app/actions/crm-employees.actions';

const initialState: { message?: string; error?: string; newDepartment?: any } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Department
        </ZoruButton>
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
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-foreground">Add New Department</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-muted-foreground">
                        Create a new department for your organization.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <ZoruLabel htmlFor="name" className="text-foreground">Department Name</ZoruLabel>
                        <ZoruInput id="name" name="name" defaultValue={defaultName} required />
                    </div>
                    <div className="grid gap-2">
                        <ZoruLabel htmlFor="description" className="text-foreground">Description</ZoruLabel>
                        <ZoruInput id="description" name="description" />
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
