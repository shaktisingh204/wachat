
'use client';

import { useEffect, useState, useTransition, useActionState, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { getEcommPages, saveEcommPage } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommShop, EcommProduct, WebsiteBlock, EcommPage } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, LoaderCircle, Save, ArrowLeft, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BlockPalette } from './block-palette';
import { Canvas } from './canvas';
import { PropertiesPanel } from './properties-panel';
import Link from 'next/link';
import { PageManagerPanel } from './page-manager-panel';

const initialState = { message: null, error: undefined };

function SaveButton({ disabled }: { disabled?: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button size="lg" disabled={pending || disabled}>
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

const findList = (items: WebsiteBlock[], droppableId: string): WebsiteBlock[] | null => {
    if (droppableId === 'canvas') return items;
    for (const item of items) {
        if (item.id === droppableId) {
            if (!item.children) item.children = [];
            return item.children;
        }
        if (item.children) {
            const found = findList(item.children, droppableId);
            if (found) return found;
        }
    }
    return null;
};

const removeBlockById = (items: WebsiteBlock[], idToRemove: string): WebsiteBlock[] => {
    return items.filter(item => {
        if (item.id === idToRemove) {
            return false;
        }
        if (item.children) {
            item.children = removeBlockById(item.children, idToRemove);
        }
        return true;
    });
};

export function WebsiteBuilder({ shop, initialPages, availableProducts }: { shop: WithId<EcommShop>, initialPages: WithId<EcommPage>[], availableProducts: WithId<EcommProduct>[] }) {
    const [pages, setPages] = useState<WithId<EcommPage>[]>(initialPages);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const [layout, setLayout] = useState<WebsiteBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const homepage = pages.find(p => p.isHomepage) || pages[0];
        if (homepage) {
            setActivePageId(homepage._id.toString());
            setLayout(homepage.layout || []);
        } else if (pages.length === 0) {
            // If no pages exist, create a default homepage
            const newHomePage: WebsiteBlock[] = []; // You might want a default template
            const newPage: WithId<EcommPage> = {
                _id: new ObjectId(), // Temp client-side ID
                name: 'Home',
                slug: 'home',
                isHomepage: true,
                layout: newHomePage,
                shopId: shop._id,
                projectId: shop.projectId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setPages([newPage]);
            setActivePageId(newPage._id.toString());
            setLayout(newHomePage);
        }
    }, []); // Run only once on initial load

    const activePage = useMemo(() => pages.find(p => p._id.toString() === activePageId), [pages, activePageId]);

    const handleSavePage = async () => {
        if (!activePage) return;
        const result = await saveEcommPage({
            pageId: activePage._id.toString().startsWith('temp_') ? undefined : activePage._id.toString(),
            shopId: shop._id.toString(),
            name: activePage.name,
            slug: activePage.slug,
            layout: layout,
        });

        if (result.error) {
            toast({ title: 'Error Saving Page', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Page Saved!', description: result.message });
            fetchPages();
        }
    };
    
    const fetchPages = async () => {
        const newPages = await getEcommPages(shop._id.toString());
        setPages(newPages);
    };

    const handleAddBlock = (type: WebsiteBlock['type']) => {
        const newBlock: WebsiteBlock = {
            id: uuidv4(),
            type: type,
            settings: {},
            ...(type === 'section' && { children: [] }),
        };
        
        if (type === 'columns') {
            const columnCount = 2; // Default
            newBlock.children = Array.from({ length: columnCount }, () => ({ id: uuidv4(), type: 'column', settings: {}, children: [] }));
            newBlock.settings = { columnCount };
        }

        setLayout(prev => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
    };

    const handleUpdateBlock = (id: string, newSettings: any) => {
        const updateRecursively = (items: WebsiteBlock[]): WebsiteBlock[] => {
            return items.map(block => {
                if (block.id === id) {
                    const updatedBlock = { ...block, settings: newSettings };
                    if (block.type === 'columns' && newSettings.columnCount !== (block.settings.columnCount || 0)) {
                        const currentCount = block.children?.length || 0;
                        const newCount = newSettings.columnCount || 0;
                        let newChildren = [...(block.children || [])];
                        if (newCount > currentCount) {
                            for (let i = 0; i < newCount - currentCount; i++) {
                                newChildren.push({ id: uuidv4(), type: 'column', settings: {}, children: [] });
                            }
                        } else if (newCount < currentCount) {
                            newChildren = newChildren.slice(0, newCount);
                        }
                        updatedBlock.children = newChildren;
                    }
                    return updatedBlock;
                }
                if (block.children) {
                    return { ...block, children: updateRecursively(block.children) };
                }
                return block;
            });
        };
        setLayout(prev => updateRecursively(prev));
    };

    const handleRemoveBlock = (idToRemove: string) => {
        setLayout(prev => removeBlockById(prev, idToRemove));
        if (selectedBlockId === idToRemove) setSelectedBlockId(null);
    };
    
    const onDragEnd = (result: DropResult) => {
        const { source, destination, type } = result;
        if (!destination) return;

        const layoutCopy = JSON.parse(JSON.stringify(layout));
        const sourceList = findList(layoutCopy, source.droppableId);
        const destList = findList(layoutCopy, destination.droppableId);

        if (!sourceList || !destList) return;

        const [removed] = sourceList.splice(source.index, 1);
        destList.splice(destination.index, 0, removed);
        
        setLayout(layoutCopy);
    };

    const handleSelectPage = (pageId: string) => {
        const page = pages.find(p => p._id.toString() === pageId);
        if (page) {
            setActivePageId(pageId);
            setLayout(page.layout || []);
            setSelectedBlockId(null);
        }
    };
    
    const selectedBlock = useMemo(() => {
        if (!selectedBlockId) return undefined;
        const findRecursively = (items: WebsiteBlock[]): WebsiteBlock | undefined => {
            for (const item of items) {
                if (item.id === selectedBlockId) return item;
                if (item.children) {
                    const found = findRecursively(item.children);
                    if (found) return found;
                }
            }
            return undefined;
        };
        return findRecursively(layout);
    }, [selectedBlockId, layout]);
    
    return (
        <form action={handleSavePage}>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="h-screen w-screen bg-muted flex flex-col">
                    <header className="flex-shrink-0 h-16 bg-background border-b flex items-center justify-between px-4">
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/facebook/custom-ecommerce">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Shops
                            </Link>
                        </Button>
                        <div className="text-center">
                            <p className="font-semibold">{shop.name}</p>
                            <p className="text-xs text-muted-foreground">Editing: {activePage?.name || 'New Page'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" asChild>
                                <Link href={`/shop/${shop.slug}/${activePage?.slug || ''}`} target="_blank">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Preview
                                </Link>
                            </Button>
                            <SaveButton />
                        </div>
                    </header>
                    <div className="flex-1 grid grid-cols-12 min-h-0">
                        <div className="col-span-2 bg-background border-r p-4 overflow-y-auto">
                            <PageManagerPanel pages={pages} activePageId={activePageId} onSelectPage={handleSelectPage} shopId={shop._id.toString()} onPagesUpdate={fetchPages} />
                            <Separator className="my-4"/>
                            <BlockPalette onAddBlock={handleAddBlock} />
                        </div>
                        <div className="col-span-7 bg-muted/50 overflow-y-auto p-4">
                            <Canvas 
                                layout={layout}
                                droppableId="canvas"
                                onBlockClick={setSelectedBlockId}
                                selectedBlockId={selectedBlockId}
                                onRemoveBlock={handleRemoveBlock}
                                products={availableProducts}
                                shopSlug={shop.slug}
                                isEditable={true}
                            />
                        </div>
                        <div className="col-span-3 bg-background border-l p-4 overflow-y-auto">
                            <PropertiesPanel
                                selectedBlock={selectedBlock}
                                availableProducts={availableProducts}
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

// Temporary ObjectId for client-side creation
class ObjectId {
    readonly _id: string;
    constructor() {
        this._id = `temp_${Math.random().toString(36).substring(2, 15)}`;
    }
    toString() { return this._id }
    toHexString() { return this._id }
}
