
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Send, ShoppingBag } from 'lucide-react';
import { handleSendCatalogMessage } from '@/app/actions/whatsapp.actions';
import { getProductsForCatalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Contact, Project } from '@/lib/definitions';
import { ZoruTextarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import Image from 'next/image';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Catalog
        </ZoruButton>
    );
}

interface SendCatalogDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
    project: WithId<Project>;
}

export function SendCatalogDialog({ isOpen, onOpenChange, contact, project }: SendCatalogDialogProps) {
    const [state, formAction] = useActionState(handleSendCatalogMessage, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        if (isOpen && project.connectedCatalogId) {
            startLoading(async () => {
                const fetchedProducts = await getProductsForCatalog(project.connectedCatalogId!, project._id.toString());
                setProducts(fetchedProducts as any);
            });
        }
    }, [isOpen, project]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onOpenChange(false);
            formRef.current?.reset();
            setSelectedProducts([]);
        }
        if (state.error) {
            toast({ title: 'Error Sending Catalog', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange]);

    const handleProductSelect = (productId: string, checked: boolean) => {
        setSelectedProducts(prev =>
            checked ? [...prev, productId] : prev.filter(id => id !== productId)
        );
    };

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <input type="hidden" name="projectId" value={project._id.toString()} />
                    <input type="hidden" name="productRetailerIds" value={selectedProducts.join(',')} />

                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle className="flex items-center gap-2"><ShoppingBag />Send Product Catalog</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            ZoruSelect products to send to {contact.name}. You can send up to 30 items at a time.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="grid gap-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="headerText">Header Text</ZoruLabel>
                                    <ZoruInput id="headerText" name="headerText" placeholder="Our Top Products" required />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="footerText">Footer Text (Optional)</ZoruLabel>
                                    <ZoruInput id="footerText" name="footerText" placeholder="Sale ends soon!" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="bodyText">Body Text</ZoruLabel>
                                <ZoruTextarea id="bodyText" name="bodyText" placeholder="Check out these amazing products from our collection." required />
                            </div>

                            <div className="space-y-2">
                                <ZoruLabel>ZoruSelect Products ({selectedProducts.length}/30)</ZoruLabel>
                                <ScrollArea className="h-64 border rounded-md p-2">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <LoaderCircle className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : products.length > 0 ? (
                                        <div className="space-y-2">
                                            {products.map(product => (
                                                <div key={product.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                                                    <Checkbox
                                                        id={`product-${product.id}`}
                                                        checked={selectedProducts.includes(product.retailer_id)}
                                                        onCheckedChange={(checked) => handleProductSelect(product.retailer_id, !!checked)}
                                                        disabled={selectedProducts.length >= 30 && !selectedProducts.includes(product.retailer_id)}
                                                    />
                                                    <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center">
                                                        {product.image_url ? <Image src={product.image_url} alt={product.name} width={48} height={48} className="object-cover rounded-md" /> : <ShoppingBag className="h-6 w-6 text-gray-400" />}
                                                    </div>
                                                    <ZoruLabel htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer">
                                                        <p className="font-medium">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground font-mono">{product.retailer_id}</p>
                                                    </ZoruLabel>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 text-muted-foreground">No products found in this catalog.</div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
