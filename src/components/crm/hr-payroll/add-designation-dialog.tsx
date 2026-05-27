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
import { saveCrmDesignation } from '@/app/actions/crm-employees.actions';

const initialState: { message?: string; error?: string; newDesignation?: any } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Designation
        </Button>
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-zoru-ink">Add New Designation</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-zoru-ink-muted">
                        Create a new designation for your organization.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-zoru-ink">Designation Name</Label>
                        <Input id="name" name="name" defaultValue={defaultName} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-zoru-ink">Description</Label>
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
