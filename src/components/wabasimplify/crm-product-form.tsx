

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, EcommProduct, EcommProductVariant, User } from '@/lib/definitions';
import { saveCrmProduct, getSession } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';

const initialState = { message: null, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
    )
}

interface CrmProductFormProps {
  product?: WithId<EcommProduct> | null;
}

export function CrmProductForm({ product }: CrmProductFormProps) {
    const [state, formAction] = useActionState(saveCrmProduct, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [user, setUser] = useState<User | null>(null);

    const isEditing = !!product;
    const [variants, setVariants] = useState<EcommProductVariant[]>([]);

    useEffect(() => {
        getSession().then(session => setUser(session?.user || null));
        if (product?.variants) {
            setVariants(product.variants);
        } else {
            setVariants([]);
        }
    }, [product]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/inventory/items');
        }
        if (state.error) {
            toast({ title: 'Error Saving Product', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);
    
    const handleAddVariant = () => {
        setVariants(prev => [...prev, { id: uuidv4(), name: '', options: '' }]);
    };

    const handleRemoveVariant = (id: string) => {
        setVariants(prev => prev.filter(v => v.id !== id));
    };

    const handleVariantChange = (id: string, field: 'name' | 'options', value: string) => {
        setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };
    
    const currency = user?.plan?.currency || 'USD';

    return (
        <form action={formAction} ref={formRef}>
             <input type="hidden" name="productId" value={product?._id.toString()} />
             <input type="hidden" name="imageUrl" value={product?.imageUrl || ''} />
             <input type="hidden" name="variants" value={JSON.stringify(variants)} />
             
            <Card>
                <CardContent className="p-6">
                     <Accordion type="multiple" defaultValue={['basic', 'pricing', 'stock', 'shipping']} className="w-full">
                        <AccordionItem value="basic">
                            <AccordionTrigger>Basic Information</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Item Name *</Label>
                                    <Input id="name" name="name" defaultValue={product?.name} required />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="sku">SKU</Label>
                                    <Input id="sku" name="sku" defaultValue={product?.sku} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unit">Unit</Label>
                                    <Input id="unit" name="unit" defaultValue={product?.unit} placeholder="e.g. PCS, Kgs, Box" />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="hsnSac">HSN/SAC Code</Label>
                                    <Input id="hsnSac" name="hsnSac" defaultValue={product?.hsnSac} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="classification">
                            <AccordionTrigger>Classification</AccordionTrigger>
                             <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>Item Type</Label>
                                    <RadioGroup name="itemType" defaultValue={product?.itemType || 'goods'} className="flex gap-4 pt-2">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="goods" id="type-goods" /><Label htmlFor="type-goods" className="font-normal">Goods</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="service" id="type-service" /><Label htmlFor="type-service" className="font-normal">Service</Label></div>
                                    </RadioGroup>
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
                                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                                    <Input id="tags" name="tags" defaultValue={product?.tags?.join(', ')} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="pricing">
                            <AccordionTrigger>Pricing</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="price">Selling Price ({currency}) *</Label>
                                        <Input id="price" name="price" type="number" step="0.01" defaultValue={product?.price} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="buyingPrice">Buying Price ({currency})</Label>
                                        <Input id="buyingPrice" name="buyingPrice" type="number" step="0.01" defaultValue={product?.buyingPrice} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="landedCost">Landed Cost</Label>
                                        <Input id="landedCost" name="landedCost" type="number" step="0.01" defaultValue={product?.landedCost} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="taxRate">Tax Rate (%)</Label>
                                        <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue={product?.taxRate} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="stock">
                            <AccordionTrigger>Stock Management</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Switch id="manageStock" name="manageStock" defaultChecked={product?.manageStock !== false} />
                                    <Label htmlFor="manageStock">Manage Stock for this item</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="stockInHand">Stock In Hand</Label>
                                        <Input id="stockInHand" name="stockInHand" type="number" defaultValue={product?.stockInHand} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="committedStock">Committed Stock</Label>
                                        <Input id="committedStock" name="committedStock" type="number" defaultValue={product?.committedStock} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reorderPoint">Reorder Point</Label>
                                        <Input id="reorderPoint" name="reorderPoint" type="number" defaultValue={product?.reorderPoint} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="overstockPoint">Overstock Point</Label>
                                        <Input id="overstockPoint" name="overstockPoint" type="number" defaultValue={product?.overstockPoint} />
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="dimensions">
                            <AccordionTrigger>Dimensions & Weight</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2"><Label>Length</Label><Input name="length" type="number" step="0.01" defaultValue={product?.dimensions?.length} /></div>
                                    <div className="space-y-2"><Label>Breadth</Label><Input name="breadth" type="number" step="0.01" defaultValue={product?.dimensions?.breadth} /></div>
                                    <div className="space-y-2"><Label>Height</Label><Input name="height" type="number" step="0.01" defaultValue={product?.dimensions?.height} /></div>
                                    <div className="space-y-2"><Label>Volume (m³)</Label><Input name="volume" type="number" step="0.01" defaultValue={product?.dimensions?.volume} /></div>
                                </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label>Gross Weight (kg)</Label><Input name="grossWeight" type="number" step="0.01" defaultValue={product?.weight?.gross} /></div>
                                    <div className="space-y-2"><Label>Net Weight (kg)</Label><Input name="netWeight" type="number" step="0.01" defaultValue={product?.weight?.net} /></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                         <AccordionItem value="image">
                             <AccordionTrigger>Image & Variants</AccordionTrigger>
                             <AccordionContent className="pt-4 space-y-6">
                                 <div className="space-y-2">
                                    <Label htmlFor="imageFile">Product Image</Label>
                                    <Input id="imageFile" name="imageFile" type="file" accept="image/*" ref={fileInputRef} />
                                    {product?.imageUrl && <p className="text-xs text-muted-foreground">Current image is set. Uploading a new file will replace it.</p>}
                                </div>
                                <Separator />
                                <div className="space-y-4">
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
                             </AccordionContent>
                         </AccordionItem>
                    </Accordion>
                    <div className="flex justify-end pt-6">
                        <SubmitButton isEditing={isEditing} />
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
