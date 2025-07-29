

'use client';

import { useEffect, useState, useMemo } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { getWebsitePages, saveWebsitePage } from '@/app/actions/portfolio.actions';
import type { WithId, Website, WebsitePage, EcommProduct, WebsiteBlock } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, LoaderCircle, Save, ArrowLeft, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BlockPalette } from './block-palette';
import { Canvas } from './canvas';
import { PropertiesPanel } from './properties-panel';
import Link from 'next/link';
import { PageManagerPanel } from './page-manager-panel';
import { Separator } from '@/components/ui/separator';
import { WebsiteBuilderHeader } from './website-builder-header';

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

export function WebsiteBuilder({ site, initialPages, availableProducts }: { site: WithId<Website>, initialPages: WithId<WebsitePage>[], availableProducts: WithId<EcommProduct>[] }) {
    const [pages, setPages] = useState<WithId<WebsitePage>[]>(initialPages);
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
            const newPage: WithId<WebsitePage> = {
                _id: `temp_${uuidv4()}` as any,
                name: 'Home',
                slug: 'home',
                isHomepage: true,
                layout: newHomePage,
                siteId: site._id,
                userId: site.userId,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            setPages([newPage]);
            setActivePageId(newPage._id.toString());
            setLayout(newHomePage);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    const activePage = useMemo(() => pages.find(p => p._id.toString() === activePageId), [pages, activePageId]);

    const handleSavePage = async () => {
        if (!activePage) return;
        const result = await saveWebsitePage({
            pageId: activePage._id.toString().startsWith('temp_') ? undefined : activePage._id.toString(),
            siteId: site._id.toString(),
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
        const newPages = await getWebsitePages(site._id.toString());
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

    const handleSelectSurface = (surfaceId: string) => {
        const page = pages.find(p => p._id.toString() === surfaceId);
        if (page) {
            setActivePageId(surfaceId);
            setLayout(page.layout || []);
            setSelectedBlockId(null);
        }
        // TODO: Add logic to switch to editing site parts (header, footer, etc.)
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
                    <WebsiteBuilderHeader site={site} pages={pages} activeSurface={activePageId || ''} onSwitchSurface={handleSelectSurface} onSave={handleSavePage} isSaving={false}/>
                    <div className="flex-1 grid grid-cols-12 min-h-0">
                        <div className="col-span-2 bg-background border-r p-4 overflow-y-auto">
                            <PageManagerPanel pages={pages} activePageId={activePageId} onSelectPage={handleSelectSurface} shopId={site._id.toString()} onPagesUpdate={fetchPages} />
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
                                shopSlug={site.slug}
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
