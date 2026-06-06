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
} from '@/components/sabcrm/20ui/compat';
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
        <Button
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
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
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-[var(--st-text)]">Add New Department</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-[var(--st-text-secondary)]">
                        Create a new department for your organization.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-[var(--st-text)]">Department Name</Label>
                        <Input id="name" name="name" defaultValue={defaultName} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-[var(--st-text)]">Description</Label>
                        <Input id="description" name="description" />
                    </div>
                    <ZoruDialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
