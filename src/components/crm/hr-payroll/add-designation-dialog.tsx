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
import { saveCrmDesignation } from '@/app/actions/crm-employees.actions';
import { ClayButton } from '@/components/clay';

const initialState: { message?: string; error?: string; newDesignation?: any } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Designation
        </ClayButton>
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-clay-ink">Add New Designation</DialogTitle>
                    <DialogDescription className="text-clay-ink-muted">
                        Create a new designation for your organization.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-clay-ink">Designation Name</Label>
                        <Input id="name" name="name" defaultValue={defaultName} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-clay-ink">Description</Label>
                        <Input id="description" name="description" />
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
