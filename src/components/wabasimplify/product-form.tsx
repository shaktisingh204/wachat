
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ZoruButton, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, EcommProductVariant } from '@/lib/definitions';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { ZoruSeparator } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { addProductToCatalog, updateProductInCatalog } from '@/app/actions/catalog.actions';
import { v4 as uuidv4 } from 'uuid';
import { useProject } from '@/context/project-context';

const initialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </ZoruButton>
    );
}

interface ProductFormProps {
  product?: WithId<any> | null;
}

export function ProductForm({ product }: ProductFormProps) {
    const { activeProjectId } = useProject();
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    
    const catalogId = (params.catalogId as string) || searchParams.get('catalogId');
    const isEditing = !!product;

    const [state, formAction] = useActionState((isEditing ? updateProductInCatalog : addProductToCatalog) as any, initialState as any);
    const formRef = useRef<HTMLFormElement>(null);
    
    const [variants, setVariants] = useState<EcommProductVariant[]>([]);
    const [salePriceEffectiveDate, setSalePriceEffectiveDate] = useState<Date | undefined>();

    useEffect(() => {
        if (product) {
            setVariants(product.variants || []);
            setSalePriceEffectiveDate(product.sale_price_effective_date ? new Date(product.sale_price_effective_date) : undefined);
        }
    }, [product]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push(`/wachat/catalog/${catalogId}`);
            router.refresh();
        }
        if (state.error) {
            toast({ title: 'Error Saving Product', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, catalogId]);
    
    const handleAddVariant = () => setVariants(prev => [...prev, { id: uuidv4(), name: '', options: '' }]);
    const handleRemoveVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id));
    const handleVariantChange = (id: string, field: 'name' | 'options', value: string) => setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));

    return (
        <form action={formAction} ref={formRef} className="space-y-6">
            <input type="hidden" name="projectId" value={activeProjectId || ''} />
            <input type="hidden" name="catalogId" value={catalogId || ''} />
            {isEditing && <input type="hidden" name="productId" value={product.id} />}
            <input type="hidden" name="variants" value={JSON.stringify(variants)} />
            <input type="hidden" name="sale_price_effective_date" value={salePriceEffectiveDate?.toISOString() || ''} />

            <ZoruAccordion type="multiple" defaultValue={['basic', 'pricing', 'identifiers']} className="w-full">
                <ZoruAccordionItem value="basic">
                    <ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                        <div className="space-y-2"><ZoruLabel htmlFor="title">Product Name (title) *</ZoruLabel><ZoruInput id="title" name="title" defaultValue={product?.name} required /></div>
                        <div className="space-y-2"><ZoruLabel htmlFor="description">Description *</ZoruLabel><ZoruTextarea id="description" name="description" defaultValue={product?.description} required /></div>
                        <div className="space-y-2"><ZoruLabel htmlFor="link">Product Link *</ZoruLabel><ZoruInput id="link" name="link" type="url" defaultValue={product?.link} placeholder="https://your-store.com/product/item" required /></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="images">
                    <ZoruAccordionTrigger>Images</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="image_link">Main Image URL *</ZoruLabel><ZoruInput id="image_link" name="image_link" type="url" defaultValue={product?.image_url} required /></div>
                        <div className="space-y-2"><ZoruLabel htmlFor="additional_image_link">Additional Image URLs (one per line)</ZoruLabel><ZoruTextarea id="additional_image_link" name="additional_image_link" defaultValue={product?.additional_image_link?.join('\n')}/></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="pricing">
                    <ZoruAccordionTrigger>Pricing & Availability</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="price">Price *</ZoruLabel><ZoruInput id="price" name="price" defaultValue={`${product?.price ? product.price / 100 : ''} ${product?.currency || 'INR'}`} placeholder="e.g. 999 INR" required /></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="availability">Availability *</ZoruLabel><ZoruSelect name="availability" defaultValue={product?.availability || 'in stock'} required><ZoruSelectTrigger id="availability"><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="in stock">In Stock</ZoruSelectItem><ZoruSelectItem value="out of stock">Out of Stock</ZoruSelectItem><ZoruSelectItem value="preorder">Preorder</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="sale_price">Sale Price</ZoruLabel><ZoruInput id="sale_price" name="sale_price" defaultValue={product?.sale_price ? `${product.sale_price / 100} ${product.currency}` : ''} placeholder="e.g. 799 INR"/></div>
                            <div className="space-y-2"><ZoruLabel>Sale Dates</ZoruLabel><DatePicker date={salePriceEffectiveDate} setDate={setSalePriceEffectiveDate} /></div>
                        </div>
                            <div className="space-y-2"><ZoruLabel htmlFor="tax">Tax %</ZoruLabel><ZoruInput id="tax" name="tax" type="number" step="0.01" defaultValue={product?.tax} /></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                 <ZoruAccordionItem value="identifiers">
                    <ZoruAccordionTrigger>Identifiers & Categories</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="retailer_id">SKU / retailer_id *</ZoruLabel><ZoruInput id="retailer_id" name="retailer_id" defaultValue={product?.retailer_id} required /></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="condition">Condition *</ZoruLabel><ZoruSelect name="condition" defaultValue={product?.condition || 'new'}><ZoruSelectTrigger id="condition"><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="new">New</ZoruSelectItem><ZoruSelectItem value="used">Used</ZoruSelectItem><ZoruSelectItem value="refurbished">Refurbished</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </div>
                            <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="brand">Brand</ZoruLabel><ZoruInput id="brand" name="brand" defaultValue={product?.brand}/></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="gtin">GTIN (Barcode)</ZoruLabel><ZoruInput id="gtin" name="gtin" defaultValue={product?.gtin}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="google_product_category">Google Product Category</ZoruLabel><ZoruInput id="google_product_category" name="google_product_category" defaultValue={product?.google_product_category}/></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="product_type">Your Product Type</ZoruLabel><ZoruInput id="product_type" name="product_type" defaultValue={product?.product_type}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="mpn">MPN</ZoruLabel><ZoruInput id="mpn" name="mpn" defaultValue={product?.mpn}/></div>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="variants">
                    <ZoruAccordionTrigger>Variants (e.g. Size, Color)</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="item_group_id">Item Group ID</ZoruLabel><ZoruInput id="item_group_id" name="item_group_id" defaultValue={product?.item_group_id} /><p className="text-xs text-muted-foreground">All variants of the same product must have the same group ID.</p></div>
                        <ZoruSeparator />
                        <div className="space-y-2"><ZoruLabel>Variant Attributes</ZoruLabel>
                            <div className="space-y-3">
                                {variants.map((variant, index) => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border rounded-md"><ZoruInput placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><ZoruInput placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton></div>))}
                            </div>
                            <ZoruButton type="button" variant="outline" size="sm" className="w-full mt-2" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant Attribute</ZoruButton>
                        </div>
                            <ZoruSeparator />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="gender">Gender</ZoruLabel><ZoruSelect name="gender" defaultValue={product?.gender}><ZoruSelectTrigger><ZoruSelectValue placeholder="ZoruSelect..."/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="male">Male</ZoruSelectItem><ZoruSelectItem value="female">Female</ZoruSelectItem><ZoruSelectItem value="unisex">Unisex</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="age_group">Age Group</ZoruLabel><ZoruSelect name="age_group" defaultValue={product?.age_group}><ZoruSelectTrigger><ZoruSelectValue placeholder="ZoruSelect..."/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="adult">Adult</ZoruSelectItem><ZoruSelectItem value="kids">Kids</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                 <ZoruAccordionItem value="stock">
                    <ZoruAccordionTrigger>Stock & Shipping</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                        <div className="space-y-2"><ZoruLabel htmlFor="inventory">Stock Quantity</ZoruLabel><ZoruInput id="inventory" name="inventory" type="number" defaultValue={product?.inventory}/></div>
                        <div className="space-y-2"><ZoruLabel htmlFor="shipping_weight">Shipping Weight (e.g. 2.5 kg)</ZoruLabel><ZoruInput id="shipping_weight" name="shipping_weight" defaultValue={product?.shipping_weight}/></div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2"><ZoruLabel>Length (cm)</ZoruLabel><ZoruInput name="shipping_length" type="number" step="0.01" defaultValue={product?.dimensions?.length}/></div>
                            <div className="space-y-2"><ZoruLabel>Width (cm)</ZoruLabel><ZoruInput name="shipping_width" type="number" step="0.01" defaultValue={product?.dimensions?.width}/></div>
                            <div className="space-y-2"><ZoruLabel>Height (cm)</ZoruLabel><ZoruInput name="shipping_height" type="number" step="0.01" defaultValue={product?.dimensions?.height}/></div>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="advanced">
                    <ZoruAccordionTrigger>Advanced / Optional</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-4 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="custom_label_0">Custom ZoruLabel 0</ZoruLabel><ZoruInput id="custom_label_0" name="custom_label_0" defaultValue={product?.custom_label_0}/></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="custom_label_1">Custom ZoruLabel 1</ZoruLabel><ZoruInput id="custom_label_1" name="custom_label_1" defaultValue={product?.custom_label_1}/></div>
                        </div>
                        <div className="space-y-2"><ZoruLabel htmlFor="visibility">Visibility</ZoruLabel><ZoruSelect name="visibility" defaultValue={product?.visibility}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="published">Published</ZoruSelectItem><ZoruSelectItem value="hidden">Hidden</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
            <div className="flex justify-end pt-6">
                <SubmitButton isEditing={isEditing}/>
            </div>
        </form>
    );
}

    