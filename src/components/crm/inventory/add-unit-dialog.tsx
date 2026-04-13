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
import { saveCrmUnit } from "@/app/actions/crm-inventory-settings.actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { ClayButton } from "@/components/clay";

interface AddUnitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultName?: string;
    onUnitAdded: (unit: any) => void;
}

export function AddUnitDialog({
    open,
    onOpenChange,
    defaultName = '',
    onUnitAdded
}: AddUnitDialogProps) {
    const [name, setName] = React.useState(defaultName);
    const [symbol, setSymbol] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (open) {
            setName(defaultName);
            setSymbol('');
        }
    }, [open, defaultName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('symbol', symbol);

        const result = await saveCrmUnit(null, formData);

        setIsSubmitting(false);

        if (result.error) {
            toast({
                title: "Error",
                description: result.error,
                variant: "destructive",
            });
        } else if (result.topic) {
            toast({
                title: "Success",
                description: "Unit added successfully.",
            });
            onUnitAdded(result.topic);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-clay-ink">Add Unit</DialogTitle>
                    <DialogDescription className="text-clay-ink-muted">
                        Create a new unit of measure (e.g. Kilogram, Piece).
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
                                placeholder="e.g. Kilogram"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="symbol" className="text-right text-clay-ink">
                                Symbol
                            </Label>
                            <Input
                                id="symbol"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="col-span-3"
                                required
                                placeholder="e.g. kg"
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
