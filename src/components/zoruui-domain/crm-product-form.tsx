'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button, Card, DatePicker, Input, Label, RadioGroup, ZoruRadioGroupItem, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';

import { LoaderCircle, Save, Plus, Trash2, Upload, X } from 'lucide-react';
import type { WithId, EcommProduct, EcommProductVariant, User, ProductBatch } from '@/lib/definitions';
import { saveCrmProduct } from '@/app/actions/crm-products.actions';
import { getSession } from '@/app/actions/index.ts';
import { v4 as uuidv4 } from 'uuid';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState = { message: null, error: undefined };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
    )
}

interface CrmProductFormProps {
  product?: WithId<EcommProduct> | null;
}

export function CrmProductForm({ product }: CrmProductFormProps) {
    const [state, formAction] = useActionState(saveCrmProduct as any, initialState as any);
    const { toast } = useToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [user, setUser] = useState<User | null>(null);

    const isEditing = !!product;
    const [variants, setVariants] = useState<EcommProductVariant[]>([]);
    const [batches, setBatches] = useState<ProductBatch[]>([]);
    const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl || '');
    const [imageName, setImageName] = useState<string>('');

    useEffect(() => {
        getSession().then(session => setUser(session?.user || null));
        setVariants(product?.variants || []);
        setBatches(product?.batches || []);
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

    const handleAddVariant = () => setVariants(prev => [...prev, { id: uuidv4(), name: '', options: '' }]);
    const handleRemoveVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id));
    const handleVariantChange = (id: string, field: 'name' | 'options', value: string) => setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));

    const handleAddBatch = () => setBatches(prev => [...prev, { id: uuidv4(), batchNumber: '', stock: 0 }]);
    const handleRemoveBatch = (id: string) => setBatches(prev => prev.filter(b => b.id !== id));
    const handleBatchChange = (id: string, field: keyof ProductBatch, value: any) => setBatches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));

    const currency = (user as any)?.plan?.currency || 'USD';

    return (
        <form action={formAction} ref={formRef}>
             <input type="hidden" name="productId" value={product?._id.toString()} />
             <input type="hidden" name="imageUrl" value={imageUrl} />
             <input type="hidden" name="variants" value={JSON.stringify(variants)} />
             <input type="hidden" name="batches" value={JSON.stringify(batches)} />

            <Card>
                <div className="p-6">
                     <Accordion type="multiple" defaultValue={['basic', 'pricing', 'stock', 'shipping']} className="w-full">
                        <AccordionItem value="basic"><AccordionTrigger>Basic Information</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2"><Label htmlFor="name">Item Name *</Label><Input id="name" name="name" defaultValue={product?.name} required /></div>
                                <div className="space-y-2"><Label htmlFor="sku">SKU</Label><Input id="sku" name="sku" defaultValue={product?.sku} /></div>
                                <div className="space-y-2"><Label htmlFor="unit">Unit</Label><EntityFormField entity="unit" name="unit" initialId={(product as any)?.unitId || null} initialLabel={product?.unit || ''} dualWriteName="unitName" /></div>
                                <div className="space-y-2"><Label htmlFor="hsnSac">HSN/SAC Code</Label><Input id="hsnSac" name="hsnSac" defaultValue={product?.hsnSac} /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="classification"><AccordionTrigger>Classification</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2"><Label>Item Type</Label><RadioGroup name="itemType" defaultValue={product?.itemType || 'goods'} className="flex gap-4 pt-2"><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="goods" id="type-goods" /><Label htmlFor="type-goods" className="font-normal">Goods</Label></div><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="service" id="type-service" /><Label htmlFor="type-service" className="font-normal">Service</Label></div></RadioGroup></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="category">Category</Label><EntityFormField entity="category" name="category" initialId={(product as any)?.categoryId || null} initialLabel={product?.category || ''} dualWriteName="categoryName" /></div><div className="space-y-2"><Label htmlFor="subcategory">Subcategory</Label><Input id="subcategory" name="subcategory" defaultValue={product?.subcategory} placeholder="e.g., T-Shirts"/></div></div>
                                <div className="space-y-2"><Label htmlFor="tags">Tags (comma-separated)</Label><Input id="tags" name="tags" defaultValue={product?.tags?.join(', ')} /></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="pricing"><AccordionTrigger>Pricing</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="price">Selling Price ({currency}) *</Label><Input id="price" name="price" type="number" step="0.01" defaultValue={product?.price} required /></div><div className="space-y-2"><Label htmlFor="buyingPrice">Buying Price ({currency})</Label><Input id="buyingPrice" name="buyingPrice" type="number" step="0.01" defaultValue={product?.buyingPrice} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="landedCost">Landed Cost</Label><Input id="landedCost" name="landedCost" type="number" step="0.01" defaultValue={product?.landedCost} /></div><div className="space-y-2"><Label htmlFor="taxRate">Tax Rate (%)</Label><Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue={product?.taxRate} /></div></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="stock"><AccordionTrigger>Stock Management</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="flex items-center space-x-2"><Switch id="manageStock" name="manageStock" defaultChecked={product?.manageStock !== false} /><Label htmlFor="manageStock">Manage Stock for this item</Label></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="stockInHand">Stock In Hand</Label><Input id="stockInHand" name="stockInHand" type="number" defaultValue={product?.stockInHand} /></div><div className="space-y-2"><Label htmlFor="committedStock">Committed Stock</Label><Input id="committedStock" name="committedStock" type="number" defaultValue={product?.committedStock} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="reorderPoint">Reorder Point</Label><Input id="reorderPoint" name="reorderPoint" type="number" defaultValue={product?.reorderPoint} /></div><div className="space-y-2"><Label htmlFor="overstockPoint">Overstock Point</Label><Input id="overstockPoint" name="overstockPoint" type="number" defaultValue={product?.overstockPoint} /></div></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="batches"><AccordionTrigger>Batch Tracking</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="flex items-center space-x-2"><Switch id="batchTracking" name="batchTracking" defaultChecked={product?.batchTracking || false}/><Label htmlFor="batchTracking">Track inventory in batches</Label></div>
                                <div className="space-y-3">
                                    {batches.map((batch, index) => (
                                        <div key={batch.id} className="grid grid-cols-[1fr,1fr,auto,auto,auto] items-end gap-2 p-2 border border-[var(--st-border)] rounded-md">
                                            <div className="space-y-1"><Label className="text-xs">Batch No.</Label><Input value={batch.batchNumber} onChange={e => handleBatchChange(batch.id, 'batchNumber', e.target.value)} /></div>
                                            <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={batch.stock} onChange={e => handleBatchChange(batch.id, 'stock', Number(e.target.value))} /></div>
                                            <div className="space-y-1"><Label className="text-xs">Mfg. Date</Label><DatePicker value={batch.mfgDate ? new Date(batch.mfgDate) : undefined} onChange={(d: any) => handleBatchChange(batch.id, 'mfgDate', d)} /></div>
                                            <div className="space-y-1"><Label className="text-xs">Expiry Date</Label><DatePicker value={batch.expiryDate ? new Date(batch.expiryDate) : undefined} onChange={(d: any) => handleBatchChange(batch.id, 'expiryDate', d)} /></div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveBatch(batch.id)}><Trash2 className="h-4 w-4 text-[var(--st-danger)]"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddBatch}><Plus className="mr-2 h-4 w-4"/>Add Batch</Button>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="dimensions"><AccordionTrigger>Dimensions & Weight</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="space-y-2"><Label>Length</Label><Input name="length" type="number" step="0.01" defaultValue={product?.dimensions?.length} /></div><div className="space-y-2"><Label>Breadth</Label><Input name="breadth" type="number" step="0.01" defaultValue={product?.dimensions?.breadth} /></div><div className="space-y-2"><Label>Height</Label><Input name="height" type="number" step="0.01" defaultValue={product?.dimensions?.height} /></div><div className="space-y-2"><Label>Volume (m³)</Label><Input name="volume" type="number" step="0.01" defaultValue={product?.dimensions?.volume} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Gross Weight (kg)</Label><Input name="grossWeight" type="number" step="0.01" defaultValue={product?.weight?.gross} /></div><div className="space-y-2"><Label>Net Weight (kg)</Label><Input name="netWeight" type="number" step="0.01" defaultValue={product?.weight?.net} /></div></div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="image"><AccordionTrigger>Image & Variants</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-6">
                                <div className="space-y-2">
                                    <Label>Product Image</Label>
                                    <div className="flex items-center gap-2">
                                        <SabFilePickerButton
                                            accept="image"
                                            title="Pick product image"
                                            onPick={({ url, name }) => {
                                                setImageUrl(url);
                                                setImageName(name);
                                            }}
                                        >
                                            <Upload className="h-4 w-4" /> {imageUrl ? 'Replace image' : 'Choose image'}
                                        </SabFilePickerButton>
                                        {imageUrl && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Remove image"
                                                onClick={() => {
                                                    setImageUrl('');
                                                    setImageName('');
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {imageUrl && (
                                        <p className="text-xs text-[var(--st-text-secondary)] truncate">
                                            <a href={imageUrl} target="_blank" rel="noreferrer" className="underline">{imageName || 'View current image'}</a>
                                        </p>
                                    )}
                                </div>
                                <Separator />
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><Label>Variants (e.g., Size, Color)</Label><Button type="button" size="sm" variant="outline" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant</Button></div>
                                    <div className="space-y-3">{variants.map(variant => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border border-[var(--st-border)] rounded-md"><Input placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><Input placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-[var(--st-danger)]"/></Button></div>))}</div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <div className="flex justify-end pt-6">
                        <SubmitButton isEditing={isEditing} />
                    </div>
                </div>
            </Card>
        </form>
    );
}
