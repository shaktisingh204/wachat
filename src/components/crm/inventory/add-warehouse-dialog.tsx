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
import { saveCrmWarehouse } from "@/app/actions/crm-warehouses.actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ClayButton } from "@/components/clay";

interface AddWarehouseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultName?: string;
    onWarehouseAdded: (warehouse: any) => void;
}

export function AddWarehouseDialog({
    open,
    onOpenChange,
    defaultName = '',
    onWarehouseAdded
}: AddWarehouseDialogProps) {
    const [name, setName] = React.useState(defaultName);
    const [location, setLocation] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (open) {
            setName(defaultName);
            setLocation('');
        }
    }, [open, defaultName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('location', location);

        // Note: saveCrmWarehouse current implementation returns { message: string, error?: string }
        // We need it to return the ID to be useful here.
        // Since I cannot change the action file right now within this single tool call,
        // I will assume I will fix the action file in the next step.
        // Or I can invoke the action and then Refetch? No, that's not efficient.
        // I'll proceed assuming the action will be updated to return { warehouse: ... } or similar.

        const result: any = await saveCrmWarehouse(null, formData);

        setIsSubmitting(false);

        if (result.error) {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive",
            });
        } else {
            // If action doesn't return the warehouse object, we are in trouble for "Select after create".
            // I'll manually construct a partial one if needed, or better, FIX THE ACTION.
            // For now, let's look for result.warehouse or similar.
            if (result.warehouse) {
                toast({ title: "Success", description: "Warehouse created." });
                onWarehouseAdded(result.warehouse);
                onOpenChange(false);
            } else {
                toast({ title: "Success", description: "Warehouse created. Please select it from the list." });
                // Can't auto-select if no ID.
                onOpenChange(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-clay-ink">Add Warehouse</DialogTitle>
                    <DialogDescription className="text-clay-ink-muted">
                        Create a new warehouse location.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right text-clay-ink">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="location" className="text-right text-clay-ink">
                                Location
                            </Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="col-span-3"
                                placeholder="City, Address..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ClayButton type="button" variant="pill" onClick={() => onOpenChange(false)}>
                            Cancel
                        </ClayButton>
                        <ClayButton
                            type="submit"
                            variant="obsidian"
                            disabled={isSubmitting}
                            leading={isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                        >
                            Save
                        </ClayButton>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
