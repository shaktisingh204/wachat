'use client';

import { Button, Dialog, ZoruDialogContent, ZoruDialogDescription, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, Input, Label } from '@/components/sabcrm/20ui/compat';
import { useState, useRef, useEffect, useActionState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { saveCrmProduct } from '@/app/actions/crm-products.actions';
import { EntityPicker } from '@/components/crm/entity-picker';
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
        <Button
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
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
            <ZoruDialogContent className="sm:max-w-[500px]">
                <ZoruDialogHeader>
                    <ZoruDialogTitle className="text-[var(--st-text)]">Add New Product</ZoruDialogTitle>
                    <ZoruDialogDescription className="text-[var(--st-text-secondary)]">
                        Quickly add a new product. Edit full details later.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form ref={formRef} action={formAction} className="grid gap-4 py-4">
                    <input type="hidden" name="quickAdd" value="true" /> {/* Optional flag if needed on server */}
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-[var(--st-text)]">Product Name *</Label>
                        <Input id="name" name="name" required defaultValue={defaultName} placeholder="e.g. Wireless Mouse" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="sku" className="text-[var(--st-text)]">SKU *</Label>
                            <Input id="sku" name="sku" required placeholder="e.g. WM-001" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="sellingPrice" className="text-[var(--st-text)]">Selling Price *</Label>
                            <Input type="number" step="0.01" id="sellingPrice" name="sellingPrice" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-[var(--st-text)]">Category</Label>
                            <input type="hidden" name="categoryId" value={categoryId} />
                            <EntityPicker
                                entity="category"
                                value={categoryId || null}
                                onChange={(next) => setCategoryId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-[var(--st-text)]">Unit</Label>
                            <input type="hidden" name="unitId" value={unitId} />
                            <EntityPicker
                                entity="unit"
                                value={unitId || null}
                                onChange={(next) => setUnitId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))}
                            />
                        </div>
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
