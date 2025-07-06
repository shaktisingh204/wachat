
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoaderCircle, Save } from 'lucide-react';
import { updateProductInCatalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
      Save Changes
    </Button>
  );
}

interface EditProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  projectId: string;
  onProductUpdated: () => void;
}

export function EditProductDialog({ isOpen, onOpenChange, product, projectId, onProductUpdated }: EditProductDialogProps) {
    const [state, formAction] = useActionState(updateProductInCatalog, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onOpenChange(false);
            onProductUpdated();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onProductUpdated]);
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="productId" value={product.id} />
                    <DialogHeader>
                        <DialogTitle>Edit Product: {product.name}</DialogTitle>
                        <DialogDescription>Update the details for this product. Changes will be reflected in your Meta catalog.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Product Name</Label>
                            <Input id="name" name="name" defaultValue={product.name} />
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="price">Price</Label>
                                <Input id="price" name="price" type="number" step="0.01" defaultValue={product.price ? product.price / 100 : '0.00'} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="inventory">Inventory</Label>
                                <Input id="inventory" name="inventory" type="number" defaultValue={product.inventory || 100} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="availability">Availability</Label>
                            <Select name="availability" defaultValue={product.availability || 'in_stock'}>
                                <SelectTrigger id="availability"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="in_stock">In Stock</SelectItem>
                                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                                    <SelectItem value="preorder">Pre-order</SelectItem>
                                    <SelectItem value="available_for_order">Available for Order</SelectItem>
                                    <SelectItem value="discontinued">Discontinued</SelectItem>
                                </SelectContent>
                            </Select>
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
