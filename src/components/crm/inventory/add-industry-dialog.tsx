'use client';

import * as React from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { saveCrmIndustry } from "@/app/actions/crm-inventory-settings.actions";

interface AddIndustryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultName?: string;
    onIndustryAdded: (industry: any) => void;
}

export function AddIndustryDialog({
    open,
    onOpenChange,
    defaultName = '',
    onIndustryAdded
}: AddIndustryDialogProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [name, setName] = React.useState(defaultName);

    React.useEffect(() => {
        if (open) setName(defaultName);
    }, [open, defaultName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData();
        formData.append('name', name);

        try {
            const result = await saveCrmIndustry(null, formData);
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else if (result.topic) {
                toast({ title: "Success", description: result.message });
                onIndustryAdded(result.topic);
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to add industry.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Industry</DialogTitle>
                    <DialogDescription>
                        Create a new industry type for vendors.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="industry-name">Industry Name</Label>
                        <Input
                            id="industry-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Technology, Manufacturing"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Industry
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
