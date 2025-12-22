
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';

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
    const isEditing = !!product;

    const [variants, setVariants] = useState<EcommProductVariant[]>([]);
    const [salePriceEffectiveDate, setSalePriceEffectiveDate] = useState<Date | undefined>();

    useEffect(() => {
        setVariants(product?.variants || []);
        setSalePriceEffectiveDate(product?.sale_price_effective_date ? new Date(product.sale_price_effective_date) : undefined);
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
    
    const handleAddVariant = () => setVariants(prev => [...prev, { id: uuidv4(), name: '', options: '' }]);
    const handleRemoveVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id));
    const handleVariantChange = (id: string, field: 'name' | 'options', value: string) => setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    
    const onDialogChange = (open: boolean) => {
        if (!open) formRef.current?.reset();
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onDialogChange}>
            <DialogContent className="sm:max-w-3xl">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="shopId" value={shop._id.toString()} />
                    {isEditing && <input type="hidden" name="productId" value={product._id.toString()} />}
                    {isEditing && <input type="hidden" name="imageUrl" value={product.imageUrl || ''} />}
                    <input type="hidden" name="variants" value={JSON.stringify(variants)} />
                    <input type="hidden" name="sale_price_effective_date" value={salePriceEffectiveDate?.toISOString()} />
                    
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    </DialogHeader>
                     <ScrollArea className="max-h-[70vh] -mx-6 my-4 px-6">
                        <div className="space-y-4">
                            <Accordion type="multiple" defaultValue={['basic', 'pricing', 'identifiers']} className="w-full">
                                <AccordionItem value="basic">
                                    <AccordionTrigger>Basic Information</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Product Name (Title) *</Label>
                                            <Input id="title" name="title" defaultValue={product?.name} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="description">Description *</Label>
                                            <Textarea id="description" name="description" defaultValue={product?.description} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="link">Product Link *</Label>
                                            <Input id="link" name="link" type="url" defaultValue={product?.link} placeholder="https://your-store.com/product/item" required />
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="images">
                                    <AccordionTrigger>Images</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="image_link">Main Image URL *</Label>
                                            <Input id="image_link" name="image_link" type="url" defaultValue={product?.imageUrl} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="additional_image_link">Additional Image URLs (one per line)</Label>
                                            <Textarea id="additional_image_link" name="additional_image_link" defaultValue={product?.additional_image_link?.join('\n')}/>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="pricing">
                                    <AccordionTrigger>Pricing & Availability</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                         <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="price">Price *</Label><Input id="price" name="price" placeholder="e.g. 999 INR" defaultValue={`${product?.price || ''} ${shop.currency}`} required /></div>
                                            <div className="space-y-2"><Label htmlFor="availability">Availability *</Label><Select name="availability" defaultValue={product?.availability || 'in stock'}><SelectTrigger id="availability"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="in stock">In Stock</SelectItem><SelectItem value="out of stock">Out of Stock</SelectItem><SelectItem value="preorder">Preorder</SelectItem></SelectContent></Select></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="sale_price">Sale Price</Label><Input id="sale_price" name="sale_price" defaultValue={product?.sale_price} /></div>
                                            <div className="space-y-2"><Label>Sale Dates</Label><DatePicker date={salePriceEffectiveDate} setDate={setSalePriceEffectiveDate} /></div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="identifiers">
                                    <AccordionTrigger>Identifiers & Categories</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="retailer_id">SKU / retailer_id *</Label><Input id="retailer_id" name="retailer_id" defaultValue={product?.retailer_id} required /></div>
                                            <div className="space-y-2"><Label htmlFor="condition">Condition *</Label><Select name="condition" defaultValue={product?.condition || 'new'}><SelectTrigger id="condition"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem><SelectItem value="refurbished">Refurbished</SelectItem></SelectContent></Select></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="brand">Brand</Label><Input id="brand" name="brand" defaultValue={product?.brand}/></div>
                                            <div className="space-y-2"><Label htmlFor="gtin">GTIN (Barcode)</Label><Input id="gtin" name="gtin" defaultValue={product?.gtin}/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="google_product_category">Google Product Category</Label><Input id="google_product_category" name="google_product_category" defaultValue={product?.google_product_category}/></div>
                                            <div className="space-y-2"><Label htmlFor="product_type">Your Product Type</Label><Input id="product_type" name="product_type" defaultValue={product?.product_type}/></div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="stock">
                                    <AccordionTrigger>Stock & Shipping</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2"><Label htmlFor="inventory">Stock Quantity</Label><Input id="inventory" name="inventory" type="number" defaultValue={product?.inventory}/></div>
                                        <div className="space-y-2"><Label htmlFor="shipping_weight">Shipping Weight (e.g. 2.5 kg)</Label><Input id="shipping_weight" name="shipping_weight" defaultValue={product?.shipping_weight}/></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2"><Label>Length</Label><Input name="shipping_length" placeholder="cm"/></div>
                                            <div className="space-y-2"><Label>Width</Label><Input name="shipping_width" placeholder="cm"/></div>
                                            <div className="space-y-2"><Label>Height</Label><Input name="shipping_height" placeholder="cm"/></div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="variants">
                                    <AccordionTrigger>Variants</AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2"><Label htmlFor="item_group_id">Item Group ID</Label><Input id="item_group_id" name="item_group_id" defaultValue={product?.item_group_id} /><p className="text-xs text-muted-foreground">All variants of the same product must have the same group ID.</p></div>
                                        <div className="space-y-3">
                                            {variants.map(variant => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border rounded-md"><Input placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><Input placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>))}
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant Attribute</Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-6">
                        <Button type="button" variant="ghost" onClick={() => onDialogChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

    