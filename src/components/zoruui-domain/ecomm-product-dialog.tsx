'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  ScrollArea,
  Separator,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId,
  EcommShop,
  EcommProduct,
  EcommProductVariant } from '@/lib/definitions';
import { saveEcommProduct } from '@/app/actions/custom-ecommerce.actions';
import { v4 as uuidv4 } from 'uuid';

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
    const [state, formAction] = useActionState(saveEcommProduct as any, initialState as any);
    const p: any = product;
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const isEditing = !!product;

    const [variants, setVariants] = useState<EcommProductVariant[]>([]);
    const [salePriceEffectiveDate, setSalePriceEffectiveDate] = useState<Date | undefined>();

    useEffect(() => {
        if (isOpen) {
            setVariants(product?.variants || []);
            setSalePriceEffectiveDate((product as any)?.sale_price_effective_date ? new Date((product as any).sale_price_effective_date) : undefined);
        }
    }, [isOpen, product]);

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
        if (!open) {
          formRef.current?.reset();
          setVariants([]);
          setSalePriceEffectiveDate(undefined);
        }
        onOpenChange(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onDialogChange}>
            <ZoruDialogContent className="sm:max-w-3xl">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="shopId" value={shop._id.toString()} />
                    {isEditing && <input type="hidden" name="productId" value={product._id.toString()} />}
                    <input type="hidden" name="variants" value={JSON.stringify(variants)} />
                    <input type="hidden" name="sale_price_effective_date" value={salePriceEffectiveDate?.toISOString()} />
                    
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</ZoruDialogTitle>
                    </ZoruDialogHeader>
                     <ScrollArea className="max-h-[70vh] -mx-6 my-4 px-6">
                        <div className="space-y-4">
                            <Accordion type="multiple" defaultValue={['basic', 'pricing', 'identifiers']} className="w-full">
                                <ZoruAccordionItem value="basic">
                                    <ZoruAccordionTrigger>Basic Information</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
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
                                            <Input id="link" name="link" type="url" defaultValue={p?.link} placeholder="https://your-store.com/product/item" required />
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>

                                <ZoruAccordionItem value="images">
                                    <ZoruAccordionTrigger>Images</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="image_link">Main Image URL *</Label>
                                            <Input id="image_link" name="image_link" type="url" defaultValue={product?.imageUrl} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="additional_image_link">Additional Image URLs (one per line)</Label>
                                            <Textarea id="additional_image_link" name="additional_image_link" defaultValue={p?.additional_image_link?.join('\n')}/>
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>

                                <ZoruAccordionItem value="pricing">
                                    <ZoruAccordionTrigger>Pricing & Availability</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
                                         <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="price">Price *</Label><Input id="price" name="price" placeholder={`e.g. 999 ${shop.currency}`} defaultValue={`${product?.price || ''} ${shop.currency}`} required /></div>
                                            <div className="space-y-2"><Label htmlFor="availability">Availability *</Label><Select name="availability" defaultValue={p?.availability || 'in stock'}><ZoruSelectTrigger id="availability"><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="in stock">In Stock</ZoruSelectItem><ZoruSelectItem value="out of stock">Out of Stock</ZoruSelectItem><ZoruSelectItem value="preorder">Preorder</ZoruSelectItem></ZoruSelectContent></Select></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="sale_price">Sale Price</Label><Input id="sale_price" name="sale_price" defaultValue={p?.sale_price} /></div>
                                            <div className="space-y-2"><Label>Sale Dates</Label><DatePicker date={salePriceEffectiveDate} setDate={setSalePriceEffectiveDate} /></div>
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>

                                <ZoruAccordionItem value="identifiers">
                                    <ZoruAccordionTrigger>Identifiers & Categories</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="retailer_id">SKU / retailer_id *</Label><Input id="retailer_id" name="retailer_id" defaultValue={p?.retailer_id} required /></div>
                                            <div className="space-y-2"><Label htmlFor="condition">Condition *</Label><Select name="condition" defaultValue={p?.condition || 'new'}><ZoruSelectTrigger id="condition"><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="new">New</ZoruSelectItem><ZoruSelectItem value="used">Used</ZoruSelectItem><ZoruSelectItem value="refurbished">Refurbished</ZoruSelectItem></ZoruSelectContent></Select></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="brand">Brand</Label><Input id="brand" name="brand" defaultValue={p?.brand}/></div>
                                            <div className="space-y-2"><Label htmlFor="gtin">GTIN (Barcode)</Label><Input id="gtin" name="gtin" defaultValue={p?.gtin}/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="google_product_category">Google Product Category</Label><Input id="google_product_category" name="google_product_category" defaultValue={p?.google_product_category}/></div>
                                            <div className="space-y-2"><Label htmlFor="product_type">Your Product Type</Label><Input id="product_type" name="product_type" defaultValue={p?.product_type}/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="mpn">MPN</Label><Input id="mpn" name="mpn" defaultValue={p?.mpn}/></div>
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>
                                
                                <ZoruAccordionItem value="variants">
                                    <ZoruAccordionTrigger>Variants (e.g. Size, Color)</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2"><Label htmlFor="item_group_id">Item Group ID</Label><Input id="item_group_id" name="item_group_id" defaultValue={p?.item_group_id} /><p className="text-xs text-zoru-ink-muted">All variants of the same product must have the same group ID.</p></div>
                                        <Separator />
                                        <div className="space-y-2"><Label>Variant Attributes</Label>
                                            <div className="space-y-3">
                                                {variants.map(variant => (<div key={variant.id} className="grid grid-cols-[1fr,2fr,auto] items-center gap-2 p-2 border rounded-md"><Input placeholder="Name (e.g. Color)" value={variant.name} onChange={e => handleVariantChange(variant.id, 'name', e.target.value)} /><Input placeholder="Options (comma-separated)" value={variant.options} onChange={e => handleVariantChange(variant.id, 'options', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveVariant(variant.id)}><Trash2 className="h-4 w-4 text-zoru-ink"/></Button></div>))}
                                            </div>
                                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={handleAddVariant}><Plus className="mr-2 h-4 w-4"/>Add Variant Attribute</Button>
                                        </div>
                                         <Separator />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label htmlFor="gender">Gender</Label><Select name="gender" defaultValue={p?.gender}><ZoruSelectTrigger><ZoruSelectValue placeholder="Select..."/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="male">Male</ZoruSelectItem><ZoruSelectItem value="female">Female</ZoruSelectItem><ZoruSelectItem value="unisex">Unisex</ZoruSelectItem></ZoruSelectContent></Select></div>
                                            <div className="space-y-2"><Label htmlFor="age_group">Age Group</Label><Select name="age_group" defaultValue={p?.age_group}><ZoruSelectTrigger><ZoruSelectValue placeholder="Select..."/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="adult">Adult</ZoruSelectItem><ZoruSelectItem value="kids">Kids</ZoruSelectItem></ZoruSelectContent></Select></div>
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>

                                <ZoruAccordionItem value="stock">
                                    <ZoruAccordionTrigger>Stock & Shipping</ZoruAccordionTrigger>
                                    <ZoruAccordionContent className="pt-4 space-y-4">
                                        <div className="space-y-2"><Label htmlFor="inventory">Stock Quantity (quantity_to_sell_on_facebook)</Label><Input id="inventory" name="inventory" type="number" defaultValue={p?.inventory as any}/></div>
                                        <div className="space-y-2"><Label htmlFor="shipping_weight">Shipping Weight (e.g. 2.5 kg)</Label><Input id="shipping_weight" name="shipping_weight" defaultValue={p?.shipping_weight}/></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2"><Label>Length (cm)</Label><Input name="shipping_length" type="number" step="0.01" defaultValue={(p?.dimensions as any)?.length} /></div>
                                            <div className="space-y-2"><Label>Width (cm)</Label><Input name="shipping_width" type="number" step="0.01" defaultValue={(p?.dimensions as any)?.width} /></div>
                                            <div className="space-y-2"><Label>Height (cm)</Label><Input name="shipping_height" type="number" step="0.01" defaultValue={(p?.dimensions as any)?.height} /></div>
                                        </div>
                                    </ZoruAccordionContent>
                                </ZoruAccordionItem>
                            </Accordion>
                        </div>
                    </ScrollArea>
                    <ZoruDialogFooter className="pt-6">
                        <Button type="button" variant="ghost" onClick={() => onDialogChange(false)}>Cancel</Button>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
