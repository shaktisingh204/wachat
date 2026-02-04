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
import { useToast } from "@/hooks/use-toast";
import { saveCrmProduct } from '@/app/actions/crm-products.actions';
import { SmartCategorySelect } from "@/components/crm/inventory/smart-category-select";
import { SmartUnitSelect } from "@/components/crm/inventory/smart-unit-select";
import { LoaderCircle } from "lucide-react";

const initialState: { message?: string; error?: string; newProduct?: any } = {
    message: undefined,
    error: undefined,
    newProduct: undefined
};

interface QuickAddProductDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProductAdded: (product?: any) => void; // Pass back new product
    defaultName?: string;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Product
        </Button>
    )
}

import { useFormStatus } from 'react-dom';

export function QuickAddProductDialog({ open, onOpenChange, onProductAdded, defaultName = '' }: QuickAddProductDialogProps) {
    const [state, formAction] = useActionState(saveCrmProduct, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [categoryId, setCategoryId] = useState('');
    const [unitId, setUnitId] = useState('');

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            setCategoryId('');
            setUnitId('');
            onOpenChange(false);
            onProductAdded(state.newProduct); // Ensure server action returns this
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onProductAdded]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>
                        Quickly add a new product. Edit full details later.
                    </DialogDescription>
                </DialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <input type="hidden" name="quickAdd" value="true" /> {/* Optional flag if needed on server */}
                    <div className="grid gap-2">
                        <Label htmlFor="name">Product Name *</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} placeholder="e.g. Wireless Mouse" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="sku">SKU *</Label>
                            <Input id="sku" name="sku" required placeholder="e.g. WM-001" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sellingPrice">Selling Price *</Label>
                            <Input type="number" step="0.01" id="sellingPrice" name="sellingPrice" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <input type="hidden" name="categoryId" value={categoryId} />
                            <SmartCategorySelect value={categoryId} onSelect={setCategoryId} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Unit</Label>
                            <input type="hidden" name="unitId" value={unitId} />
                            <SmartUnitSelect value={unitId} onSelect={setUnitId} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
