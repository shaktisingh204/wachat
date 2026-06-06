'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import { useState, useRef, useEffect, useActionState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { saveCrmIndustry } from '@/app/actions/crm-inventory-settings.actions';
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
            Save Industry
        </Button>
    );
}

interface AddIndustryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onIndustryAdded: (industry?: any) => void;
    defaultName?: string;
}

export function AddIndustryDialog({ open, onOpenChange, onIndustryAdded, defaultName = '' }: AddIndustryDialogProps) {
    const [formState, formAction] = useActionState(saveCrmIndustry, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (formState.message) {
            toast({ title: 'Success!', description: formState.message });
            formRef.current?.reset();
            onIndustryAdded(formState.topic);
        }
        if (formState.error) {
            toast({ title: 'Error', description: formState.error, variant: 'destructive' });
        }
    }, [formState, toast, onIndustryAdded]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-[var(--st-text)]">Add Industry</DialogTitle>
                    <DialogDescription className="text-[var(--st-text-secondary)]">
                        Details about the industry.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-[var(--st-text)]">Name</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-[var(--st-text)]">Description (Optional)</Label>
                        <Textarea id="description" name="description" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
