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
import { saveCrmIndustry } from '@/app/actions/crm-inventory-settings.actions';
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
            Save Industry
        </ClayButton>
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
                    <DialogTitle className="text-foreground">Add Industry</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Details about the industry.
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
