
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
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, EcommShop, EcommProduct, EcommProductVariant } from '@/lib/definitions';
import { saveEcommProduct } from '@/app/actions/custom-ecommerce.actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
    )
}

interface EcommProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shop: WithId<EcommShop>;
  product?: WithId<EcommProduct> | null;
  onSuccess: () => void;
}

export function EcommProductDialog({ isOpen, onOpenChange, shop, product, onSuccess }: EcommProductDialogProps) {
    const [state, formAction] = useActionState(saveEcommProduct, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isEditing = !!product;

    const [variants, setVariants] = useState<EcommProductVariant[]>([]);

    useEffect(() => {
        if (product?.variants) {
            setVariants(product.variants);
        } else {
            setVariants([]);
        }
    }, [product]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onSuccess();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error Saving Product', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange, onSuccess]);
    
    const handleAddVariant = () => {
        setVariants(prev => [...prev, { id: uuidv4(), name: '', options: '' }]);
    };

    const handleRemoveVariant = (id: string) => {
        setVariants(prev => prev.filter(v => v.id !== id));
    };

    const handleVariantChange = (id: string, field: 'name' | 'options', value: string) => {
        setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };
    
    const onDialogChange = (open: boolean) => {
        if (!open) {
            formRef.current?.reset();
            setVariants([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onDialogChange}>
            <DialogContent className="sm:max-w-xl">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="shopId" value={shop._id.toString()} />
                    {isEditing && <input type="hidden" name="productId" value={product._id.toString()} />}
                     {isEditing && <input type="hidden" name="imageUrl" value={product.imageUrl || ''} />}
                    <input type="hidden" name="variants" value={JSON.stringify(variants)} />
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                        <DialogDescription>
                            Enter the details for your product.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] -mx-6 px-6 my-4">
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name</Label>
                                <Input id="name" name="name" defaultValue={product?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" defaultValue={product?.description} />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="price">Price ({shop?.currency || 'USD'})</Label>
                                    <Input id="price" name="price" type="number" step="0.01" defaultValue={product?.price} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="stock">Stock</Label>
                                    <Input id="stock" name="stock" type="number" step="1" defaultValue={product?.stock} placeholder="Leave blank for unlimited"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Input id="category" name="category" defaultValue={product?.category} placeholder="e.g., Clothing" />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="subcategory">Subcategory</Label>
                                    <Input id="subcategory" name="subcategory" defaultValue={product?.subcategory} placeholder="e.g., T-Shirts"/>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="imageFile">Product Image</Label>
                                <Input id="imageFile" name="imageFile" type="file" accept="image/*" ref={fileInputRef} />
                                {product?.imageUrl && <p className="text-xs text-muted-foreground">Current image is set. Uploading a new file will replace it.</p>}
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Variants (e.g., Size, Color)</Label>
                                    <Button type="button" size="sm" variant="outline" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant</Button>
                                </div>
                                 <div className="space-y-3">
                                    {variants.map(variant => (
                                        <div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border rounded-md">
                                            <Input placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} />
                                            <Input placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    ))}
                                 </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onDialogChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
