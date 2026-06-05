'use client';

import {
  Modal,
  Button,
  Input,
  Field,
  Textarea,
  ScrollArea,
  Checkbox,
  Spinner,
  EmptyState,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Send, ShoppingBag } from 'lucide-react';
import { handleSendCatalogMessage } from '@/app/actions/whatsapp.actions';
import { getProductsForCatalog } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId,
  Contact,
  Project } from '@/lib/definitions';

import Image from 'next/image';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="primary"
            disabled={pending}
            loading={pending}
            iconLeft={pending ? undefined : Send}
        >
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
        <Modal
            open={isOpen}
            onClose={() => onOpenChange(false)}
            size="lg"
            className="max-w-2xl"
            title={<span className="flex items-center gap-2"><ShoppingBag />Send Product Catalog</span>}
            description={`Select products to send to ${contact.name}. You can send up to 30 items at a time.`}
            footer={
                <form action={formAction} ref={formRef} className="flex items-center justify-end gap-2">
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <input type="hidden" name="projectId" value={project._id.toString()} />
                    <input type="hidden" name="productRetailerIds" value={selectedProducts.join(',')} />
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <SubmitButton />
                </form>
            }
        >
            <div className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Header Text">
                        <Input id="headerText" name="headerText" placeholder="Our Top Products" required />
                    </Field>
                    <Field label="Footer Text (Optional)">
                        <Input id="footerText" name="footerText" placeholder="Sale ends soon!" />
                    </Field>
                </div>
                <Field label="Body Text">
                    <Textarea id="bodyText" name="bodyText" placeholder="Check out these amazing products from our collection." required />
                </Field>

                <Field label={`Select Products (${selectedProducts.length}/30)`}>
                    <div className="u-card u-card--outlined rounded-md">
                        <ScrollArea style={{ height: 256 }} viewportClassName="p-2">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full py-16">
                                    <Spinner size="md" />
                                </div>
                            ) : products.length > 0 ? (
                                <div className="space-y-2">
                                    {products.map(product => {
                                        const checked = selectedProducts.includes(product.retailer_id);
                                        return (
                                            <label
                                                key={product.id}
                                                htmlFor={`product-${product.id}`}
                                                className="flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors duration-[120ms] hover:bg-[var(--st-surface-hover)]"
                                            >
                                                <Checkbox
                                                    id={`product-${product.id}`}
                                                    checked={checked}
                                                    onChange={(e) => handleProductSelect(product.retailer_id, e.target.checked)}
                                                    disabled={selectedProducts.length >= 30 && !checked}
                                                />
                                                <div className="w-12 h-12 rounded-md flex items-center justify-center bg-[var(--st-surface-muted)]">
                                                    {product.image_url ? <Image src={product.image_url} alt={product.name} width={48} height={48} className="object-cover rounded-md" /> : <ShoppingBag className="h-6 w-6 text-[var(--st-text-tertiary)]" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-[var(--st-text)]">{product.name}</p>
                                                    <p className="text-xs font-mono text-[var(--st-text-tertiary)]">{product.retailer_id}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={ShoppingBag}
                                    title="No products found"
                                    description="No products found in this catalog."
                                />
                            )}
                        </ScrollArea>
                    </div>
                </Field>
            </div>
        </Modal>
    );
}
