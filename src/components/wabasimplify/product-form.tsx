
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, EcommProductVariant } from '@/lib/definitions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addProductToCatalog, updateProductInCatalog } from '@/app/actions/catalog.actions';
import { v4 as uuidv4 } from 'uuid';
import { useProject } from '@/context/project-context';

const initialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
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

    const [state, formAction] = useActionState(isEditing ? updateProductInCatalog : addProductToCatalog, initialState);
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
            router.push(`/dashboard/catalog/${catalogId}`);
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

            <Accordion type="multiple" defaultValue={['basic', 'pricing', 'identifiers']} className="w-full">
                <AccordionItem value="basic">
                    <AccordionTrigger>Basic Information</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="title">Product Name (title) *</Label><Input id="title" name="title" defaultValue={product?.name} required /></div>
                        <div className="space-y-2"><Label htmlFor="description">Description *</Label><Textarea id="description" name="description" defaultValue={product?.description} required /></div>
                        <div className="space-y-2"><Label htmlFor="link">Product Link *</Label><Input id="link" name="link" type="url" defaultValue={product?.link} placeholder="https://your-store.com/product/item" required /></div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="images">
                    <AccordionTrigger>Images</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                            <div className="space-y-2"><Label htmlFor="image_link">Main Image URL *</Label><Input id="image_link" name="image_link" type="url" defaultValue={product?.image_url} required /></div>
                        <div className="space-y-2"><Label htmlFor="additional_image_link">Additional Image URLs (one per line)</Label><Textarea id="additional_image_link" name="additional_image_link" defaultValue={product?.additional_image_link?.join('\n')}/></div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pricing">
                    <AccordionTrigger>Pricing & Availability</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="price">Price *</Label><Input id="price" name="price" defaultValue={`${product?.price ? product.price / 100 : ''} ${product?.currency || 'INR'}`} placeholder="e.g. 999 INR" required /></div>
                            <div className="space-y-2"><Label htmlFor="availability">Availability *</Label><Select name="availability" defaultValue={product?.availability || 'in stock'} required><SelectTrigger id="availability"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="in stock">In Stock</SelectItem><SelectItem value="out of stock">Out of Stock</SelectItem><SelectItem value="preorder">Preorder</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="sale_price">Sale Price</Label><Input id="sale_price" name="sale_price" defaultValue={product?.sale_price ? `${product.sale_price / 100} ${product.currency}` : ''} placeholder="e.g. 799 INR"/></div>
                            <div className="space-y-2"><Label>Sale Dates</Label><DatePicker date={salePriceEffectiveDate} setDate={setSalePriceEffectiveDate} /></div>
                        </div>
                            <div className="space-y-2"><Label htmlFor="tax">Tax %</Label><Input id="tax" name="tax" type="number" step="0.01" defaultValue={product?.tax} /></div>
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="mpn">MPN</Label><Input id="mpn" name="mpn" defaultValue={product?.mpn}/></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="variants">
                    <AccordionTrigger>Variants (e.g. Size, Color)</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                            <div className="space-y-2"><Label htmlFor="item_group_id">Item Group ID</Label><Input id="item_group_id" name="item_group_id" defaultValue={product?.item_group_id} /><p className="text-xs text-muted-foreground">All variants of the same product must have the same group ID.</p></div>
                        <Separator />
                        <div className="space-y-2"><Label>Variant Attributes</Label>
                            <div className="space-y-3">
                                {variants.map((variant, index) => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border rounded-md"><Input placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><Input placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant Attribute</Button>
                        </div>
                            <Separator />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="gender">Gender</Label><Select name="gender" defaultValue={product?.gender}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="unisex">Unisex</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label htmlFor="age_group">Age Group</Label><Select name="age_group" defaultValue={product?.age_group}><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger><SelectContent><SelectItem value="adult">Adult</SelectItem><SelectItem value="kids">Kids</SelectItem></SelectContent></Select></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="stock">
                    <AccordionTrigger>Stock & Shipping</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                        <div className="space-y-2"><Label htmlFor="inventory">Stock Quantity</Label><Input id="inventory" name="inventory" type="number" defaultValue={product?.inventory}/></div>
                        <div className="space-y-2"><Label htmlFor="shipping_weight">Shipping Weight (e.g. 2.5 kg)</Label><Input id="shipping_weight" name="shipping_weight" defaultValue={product?.shipping_weight}/></div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Length (cm)</Label><Input name="shipping_length" type="number" step="0.01" defaultValue={product?.dimensions?.length}/></div>
                            <div className="space-y-2"><Label>Width (cm)</Label><Input name="shipping_width" type="number" step="0.01" defaultValue={product?.dimensions?.width}/></div>
                            <div className="space-y-2"><Label>Height (cm)</Label><Input name="shipping_height" type="number" step="0.01" defaultValue={product?.dimensions?.height}/></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced / Optional</AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="custom_label_0">Custom Label 0</Label><Input id="custom_label_0" name="custom_label_0" defaultValue={product?.custom_label_0}/></div>
                            <div className="space-y-2"><Label htmlFor="custom_label_1">Custom Label 1</Label><Input id="custom_label_1" name="custom_label_1" defaultValue={product?.custom_label_1}/></div>
                        </div>
                        <div className="space-y-2"><Label htmlFor="visibility">Visibility</Label><Select name="visibility" defaultValue={product?.visibility}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="published">Published</SelectItem><SelectItem value="hidden">Hidden</SelectItem></SelectContent></Select></div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            <div className="flex justify-end pt-6">
                <SubmitButton isEditing={isEditing}/>
            </div>
        </form>
    );
}

    