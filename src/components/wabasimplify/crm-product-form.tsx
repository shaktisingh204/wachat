'use client';

import {
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruButton,
  ZoruCard,
  ZoruDatePicker,
  ZoruInput,
  ZoruLabel,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
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
        <ZoruButton type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </ZoruButton>
    )
}

interface CrmProductFormProps {
  product?: WithId<EcommProduct> | null;
}

export function CrmProductForm({ product }: CrmProductFormProps) {
    const [state, formAction] = useActionState(saveCrmProduct as any, initialState as any);
    const { toast } = useZoruToast();
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

            <ZoruCard>
                <div className="p-6">
                     <ZoruAccordion type="multiple" defaultValue={['basic', 'pricing', 'stock', 'shipping']} className="w-full">
                        <ZoruAccordionItem value="basic"><ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2"><ZoruLabel htmlFor="name">Item Name *</ZoruLabel><ZoruInput id="name" name="name" defaultValue={product?.name} required /></div>
                                <div className="space-y-2"><ZoruLabel htmlFor="sku">SKU</ZoruLabel><ZoruInput id="sku" name="sku" defaultValue={product?.sku} /></div>
                                <div className="space-y-2"><ZoruLabel htmlFor="unit">Unit</ZoruLabel><EntityFormField entity="unit" name="unit" initialId={(product as any)?.unitId || null} initialLabel={product?.unit || ''} dualWriteName="unitName" /></div>
                                <div className="space-y-2"><ZoruLabel htmlFor="hsnSac">HSN/SAC Code</ZoruLabel><ZoruInput id="hsnSac" name="hsnSac" defaultValue={product?.hsnSac} /></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="classification"><ZoruAccordionTrigger>Classification</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="space-y-2"><ZoruLabel>Item Type</ZoruLabel><ZoruRadioGroup name="itemType" defaultValue={product?.itemType || 'goods'} className="flex gap-4 pt-2"><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="goods" id="type-goods" /><ZoruLabel htmlFor="type-goods" className="font-normal">Goods</ZoruLabel></div><div className="flex items-center space-x-2"><ZoruRadioGroupItem value="service" id="type-service" /><ZoruLabel htmlFor="type-service" className="font-normal">Service</ZoruLabel></div></ZoruRadioGroup></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel htmlFor="category">Category</ZoruLabel><EntityFormField entity="category" name="category" initialId={(product as any)?.categoryId || null} initialLabel={product?.category || ''} dualWriteName="categoryName" /></div><div className="space-y-2"><ZoruLabel htmlFor="subcategory">Subcategory</ZoruLabel><ZoruInput id="subcategory" name="subcategory" defaultValue={product?.subcategory} placeholder="e.g., T-Shirts"/></div></div>
                                <div className="space-y-2"><ZoruLabel htmlFor="tags">Tags (comma-separated)</ZoruLabel><ZoruInput id="tags" name="tags" defaultValue={product?.tags?.join(', ')} /></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="pricing"><ZoruAccordionTrigger>Pricing</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel htmlFor="price">Selling Price ({currency}) *</ZoruLabel><ZoruInput id="price" name="price" type="number" step="0.01" defaultValue={product?.price} required /></div><div className="space-y-2"><ZoruLabel htmlFor="buyingPrice">Buying Price ({currency})</ZoruLabel><ZoruInput id="buyingPrice" name="buyingPrice" type="number" step="0.01" defaultValue={product?.buyingPrice} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel htmlFor="landedCost">Landed Cost</ZoruLabel><ZoruInput id="landedCost" name="landedCost" type="number" step="0.01" defaultValue={product?.landedCost} /></div><div className="space-y-2"><ZoruLabel htmlFor="taxRate">Tax Rate (%)</ZoruLabel><ZoruInput id="taxRate" name="taxRate" type="number" step="0.01" defaultValue={product?.taxRate} /></div></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="stock"><ZoruAccordionTrigger>Stock Management</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="flex items-center space-x-2"><ZoruSwitch id="manageStock" name="manageStock" defaultChecked={product?.manageStock !== false} /><ZoruLabel htmlFor="manageStock">Manage Stock for this item</ZoruLabel></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel htmlFor="stockInHand">Stock In Hand</ZoruLabel><ZoruInput id="stockInHand" name="stockInHand" type="number" defaultValue={product?.stockInHand} /></div><div className="space-y-2"><ZoruLabel htmlFor="committedStock">Committed Stock</ZoruLabel><ZoruInput id="committedStock" name="committedStock" type="number" defaultValue={product?.committedStock} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel htmlFor="reorderPoint">Reorder Point</ZoruLabel><ZoruInput id="reorderPoint" name="reorderPoint" type="number" defaultValue={product?.reorderPoint} /></div><div className="space-y-2"><ZoruLabel htmlFor="overstockPoint">Overstock Point</ZoruLabel><ZoruInput id="overstockPoint" name="overstockPoint" type="number" defaultValue={product?.overstockPoint} /></div></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="batches"><ZoruAccordionTrigger>Batch Tracking</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="flex items-center space-x-2"><ZoruSwitch id="batchTracking" name="batchTracking" defaultChecked={product?.batchTracking || false}/><ZoruLabel htmlFor="batchTracking">Track inventory in batches</ZoruLabel></div>
                                <div className="space-y-3">
                                    {batches.map((batch, index) => (
                                        <div key={batch.id} className="grid grid-cols-[1fr,1fr,auto,auto,auto] items-end gap-2 p-2 border border-zoru-line rounded-md">
                                            <div className="space-y-1"><ZoruLabel className="text-xs">Batch No.</ZoruLabel><ZoruInput value={batch.batchNumber} onChange={e => handleBatchChange(batch.id, 'batchNumber', e.target.value)} /></div>
                                            <div className="space-y-1"><ZoruLabel className="text-xs">Quantity</ZoruLabel><ZoruInput type="number" value={batch.stock} onChange={e => handleBatchChange(batch.id, 'stock', Number(e.target.value))} /></div>
                                            <div className="space-y-1"><ZoruLabel className="text-xs">Mfg. Date</ZoruLabel><ZoruDatePicker value={batch.mfgDate ? new Date(batch.mfgDate) : undefined} onChange={(d: any) => handleBatchChange(batch.id, 'mfgDate', d)} /></div>
                                            <div className="space-y-1"><ZoruLabel className="text-xs">Expiry Date</ZoruLabel><ZoruDatePicker value={batch.expiryDate ? new Date(batch.expiryDate) : undefined} onChange={(d: any) => handleBatchChange(batch.id, 'expiryDate', d)} /></div>
                                            <ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveBatch(batch.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink"/></ZoruButton>
                                        </div>
                                    ))}
                                </div>
                                <ZoruButton type="button" variant="outline" size="sm" onClick={handleAddBatch}><Plus className="mr-2 h-4 w-4"/>Add Batch</ZoruButton>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="dimensions"><ZoruAccordionTrigger>Dimensions & Weight</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="space-y-2"><ZoruLabel>Length</ZoruLabel><ZoruInput name="length" type="number" step="0.01" defaultValue={product?.dimensions?.length} /></div><div className="space-y-2"><ZoruLabel>Breadth</ZoruLabel><ZoruInput name="breadth" type="number" step="0.01" defaultValue={product?.dimensions?.breadth} /></div><div className="space-y-2"><ZoruLabel>Height</ZoruLabel><ZoruInput name="height" type="number" step="0.01" defaultValue={product?.dimensions?.height} /></div><div className="space-y-2"><ZoruLabel>Volume (m³)</ZoruLabel><ZoruInput name="volume" type="number" step="0.01" defaultValue={product?.dimensions?.volume} /></div></div>
                                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Gross Weight (kg)</ZoruLabel><ZoruInput name="grossWeight" type="number" step="0.01" defaultValue={product?.weight?.gross} /></div><div className="space-y-2"><ZoruLabel>Net Weight (kg)</ZoruLabel><ZoruInput name="netWeight" type="number" step="0.01" defaultValue={product?.weight?.net} /></div></div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="image"><ZoruAccordionTrigger>Image & Variants</ZoruAccordionTrigger>
                            <ZoruAccordionContent className="pt-4 space-y-6">
                                <div className="space-y-2">
                                    <ZoruLabel>Product Image</ZoruLabel>
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
                                            <ZoruButton
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
                                            </ZoruButton>
                                        )}
                                    </div>
                                    {imageUrl && (
                                        <p className="text-xs text-zoru-ink-muted truncate">
                                            <a href={imageUrl} target="_blank" rel="noreferrer" className="underline">{imageName || 'View current image'}</a>
                                        </p>
                                    )}
                                </div>
                                <ZoruSeparator />
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><ZoruLabel>Variants (e.g., Size, Color)</ZoruLabel><ZoruButton type="button" size="sm" variant="outline" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant</ZoruButton></div>
                                    <div className="space-y-3">{variants.map(variant => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border border-zoru-line rounded-md"><ZoruInput placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><ZoruInput placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-zoru-danger-ink"/></ZoruButton></div>))}</div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                    </ZoruAccordion>
                    <div className="flex justify-end pt-6">
                        <SubmitButton isEditing={isEditing} />
                    </div>
                </div>
            </ZoruCard>
        </form>
    );
}
