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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveCrmVendorType } from '@/app/actions/crm-vendors.actions';
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
            Save Vendor Type
        </ClayButton>
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Add Vendor Type</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Create a new vendor type for your suppliers.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-foreground">Name</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
                        <Textarea id="description" name="description" />
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
