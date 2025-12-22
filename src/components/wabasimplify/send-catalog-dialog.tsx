
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, Send, ShoppingBag } from 'lucide-react';
import { handleSendCatalogMessage } from '@/app/actions/whatsapp.actions';
import { getProductsForCatalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Contact, Project } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import Image from 'next/image';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Send Catalog
    </Button>
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
        if(isOpen && project.connectedCatalogId) {
            startLoading(async () => {
                const fetchedProducts = await getProductsForCatalog(project.connectedCatalogId!, project._id.toString());
                setProducts(fetchedProducts);
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
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <input type="hidden" name="projectId" value={project._id.toString()} />
                    <input type="hidden" name="productRetailerIds" value={selectedProducts.join(',')} />
                    
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ShoppingBag/>Send Product Catalog</DialogTitle>
                        <DialogDescription>
                            Select products to send to {contact.name}. You can send up to 30 items at a time.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="headerText">Header Text</Label>
                                <Input id="headerText" name="headerText" placeholder="Our Top Products" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="footerText">Footer Text (Optional)</Label>
                                <Input id="footerText" name="footerText" placeholder="Sale ends soon!" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bodyText">Body Text</Label>
                            <Textarea id="bodyText" name="bodyText" placeholder="Check out these amazing products from our collection." required />
                        </div>

                        <div className="space-y-2">
                            <Label>Select Products ({selectedProducts.length}/30)</Label>
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
                                                    {product.image_url ? <Image src={product.image_url} alt={product.name} width={48} height={48} className="object-cover rounded-md"/> : <ShoppingBag className="h-6 w-6 text-gray-400"/>}
                                                </div>
                                                <Label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer">
                                                    <p className="font-medium">{product.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{product.retailer_id}</p>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 text-muted-foreground">No products found in this catalog.</div>
                                )}
                            </ScrollArea>
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
