'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveCrmDesignation } from '@/app/actions/crm-employees.actions';

const initialState: { message?: string; error?: string; newDesignation?: any } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Designation
        </ZoruButton>
    );
}

interface AddDesignationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDesignationAdded: (designation: any) => void;
    defaultName?: string;
}

export function AddDesignationDialog({ open, onOpenChange, onDesignationAdded, defaultName = '' }: AddDesignationDialogProps) {
    const [state, formAction] = useActionState(saveCrmDesignation, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            if (state.newDesignation) {
                onDesignationAdded(state.newDesignation);
            } else {
                onOpenChange(false);
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onDesignationAdded]);

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-foreground">Add New Designation</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-muted-foreground">
                        Create a new designation for your organization.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <ZoruLabel htmlFor="name" className="text-foreground">Designation Name</ZoruLabel>
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
