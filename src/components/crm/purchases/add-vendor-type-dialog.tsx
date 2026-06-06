'use client';

import { Button, Dialog, ZoruDialogContent, ZoruDialogDescription, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import { useState, useRef, useEffect, useActionState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { saveCrmVendorType } from '@/app/actions/crm-vendors.actions';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

const initialState = {
    message: '',
    error: ''
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
        >
            Save Vendor Type
        </Button>
    );
}

interface AddVendorTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTypeAdded: (type?: any) => void;
    defaultName?: string;
}

export function AddVendorTypeDialog({ open, onOpenChange, onTypeAdded, defaultName = '' }: AddVendorTypeDialogProps) {
    const [formState, formAction] = useActionState(saveCrmVendorType, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (formState.message) {
            toast({ title: 'Success!', description: formState.message });
            formRef.current?.reset();
            onTypeAdded(formState.topic);
        }
        if (formState.error) {
            toast({ title: 'Error', description: formState.error, variant: 'destructive' });
        }
    }, [formState, toast, onTypeAdded]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-[425px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-[var(--st-text)]">Add Vendor Type</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-[var(--st-text-secondary)]">
                        Create a new vendor type for your suppliers.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-[var(--st-text)]">Name</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-[var(--st-text)]">Description (Optional)</Label>
                        <Textarea id="description" name="description" />
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
