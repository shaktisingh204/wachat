
'use client';

import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { getEcommShopById, getEcommProducts, updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommShop, EcommProduct, WebsiteBlock } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, LoaderCircle, Save, ArrowLeft, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BlockPalette } from './block-palette';
import { Canvas } from './canvas';
import { PropertiesPanel } from './properties-panel';
import Link from 'next/link';

const initialState = { message: null, error: undefined };

function SaveButton({ disabled }: { disabled?: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="lg" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & Publish
        </Button>
    )
}

function BuilderSkeleton() {
    return (
        <div className="flex h-screen w-screen bg-muted">
            <div className="w-64 border-r p-4"><Skeleton className="h-full w-full" /></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 border-l p-4"><Skeleton className="h-full w-full" /></div>
        </div>
    );
}

export function WebsiteBuilder() {
    const params = useParams();
    const router = useRouter();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [layout, setLayout] = useState<WebsiteBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
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
        const newLayout = [...layout, newBlock];
        setLayout(newLayout);
        setSelectedBlockId(newBlock.id);
    };

    const handleUpdateBlock = (id: string, newSettings: any) => {
        setLayout(prev => prev.map(block => block.id === id ? { ...block, settings: newSettings } : block));
    };

    const handleRemoveBlock = (id: string) => {
        setLayout(prev => prev.filter(block => block.id !== id));
        if (selectedBlockId === id) {
            setSelectedBlockId(null);
        }
    };
    
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(layout);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setLayout(items);
    };

    const selectedBlock = layout.find(block => block.id === selectedBlockId);

    if (isLoading) {
        return <BuilderSkeleton />;
    }

    if (!shop) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Shop Not Found</AlertTitle>
                    <AlertDescription>Please select a valid shop to use the builder.</AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <form action={formAction}>
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="homepageLayout" value={JSON.stringify(layout)} />
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="h-screen w-screen bg-muted flex flex-col">
                    <header className="flex-shrink-0 h-16 bg-background border-b flex items-center justify-between px-4">
                        <Button variant="outline" asChild>
                            <Link href={`/dashboard/facebook/custom-ecommerce/manage/${shopId}`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Shop
                            </Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" asChild>
                                <Link href={`/shop/${shop.slug}`} target="_blank">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Link>
                            </Button>
                            <SaveButton disabled={isLoading} />
                        </div>
                    </header>
                    <div className="flex-1 grid grid-cols-12 min-h-0">
                        <div className="col-span-2 bg-background border-r p-4 overflow-y-auto">
                            <BlockPalette onAddBlock={handleAddBlock} />
                        </div>
                        <div className="col-span-7 bg-muted/50 overflow-y-auto">
                            <Canvas 
                                layout={layout}
                                setSelectedBlockId={setSelectedBlockId}
                                selectedBlockId={selectedBlockId}
                            />
                        </div>
                        <div className="col-span-3 bg-background border-l p-4 overflow-y-auto">
                            <PropertiesPanel
                                selectedBlock={selectedBlock}
                                availableProducts={products}
                                onUpdate={handleUpdateBlock}
                                onRemove={handleRemoveBlock}
                            />
                        </div>
                    </div>
                </div>
            </DragDropContext>
        </form>
    );
}
