
'use client';

import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getEcommShopById, getEcommProducts, updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommShop, EcommProduct, WebsiteBlock } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, LoaderCircle, Save, GripVertical } from 'lucide-react';
import { WebsiteBlockEditor } from '@/components/wabasimplify/website-builder/website-block-editor';
import { v4 as uuidv4 } from 'uuid';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Layout
        </Button>
    )
}

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    );
}

export default function WebsiteBuilderPage() {
    const params = useParams();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [layout, setLayout] = useState<WebsiteBlock[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [state, formAction] = useActionState(updateEcommShopSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (shopId) {
            startLoadingTransition(async () => {
                const [shopData, productsData] = await Promise.all([
                    getEcommShopById(shopId),
                    getEcommProducts(shopId),
                ]);
                setShop(shopData);
                setProducts(productsData);
                setLayout(shopData?.homepageLayout || []);
            });
        }
    }, [shopId]);

    useEffect(() => {
        if (state.message) toast({ title: 'Success', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);
    
    const handleAddBlock = (type: WebsiteBlock['type']) => {
        const newBlock: WebsiteBlock = {
            id: uuidv4(),
            type: type,
            settings: {},
        };
        setLayout(prev => [...prev, newBlock]);
    };

    const handleUpdateBlock = (id: string, newSettings: any) => {
        setLayout(prev => prev.map(block => block.id === id ? { ...block, settings: newSettings } : block));
    };

    const handleRemoveBlock = (id: string) => {
        setLayout(prev => prev.filter(block => block.id !== id));
    };


    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Shop Not Found</AlertTitle>
                <AlertDescription>Please select a valid shop.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <form action={formAction}>
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="homepageLayout" value={JSON.stringify(layout)} />

            <div className="space-y-6">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Website Builder</h2>
                        <p className="text-muted-foreground">Design your shop's homepage by adding and customizing blocks.</p>
                    </div>
                    <SubmitButton />
                </div>
                
                <div className="min-h-96 rounded-lg border-2 border-dashed bg-muted/50 p-4 space-y-4">
                    {layout.map(block => (
                        <WebsiteBlockEditor 
                            key={block.id} 
                            block={block} 
                            onUpdate={handleUpdateBlock} 
                            onRemove={handleRemoveBlock} 
                            availableProducts={products}
                        />
                    ))}

                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Block</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-4">
                            <Button type="button" variant="outline" onClick={() => handleAddBlock('hero')}>Hero Section</Button>
                            <Button type="button" variant="outline" onClick={() => handleAddBlock('featuredProducts')}>Featured Products</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
