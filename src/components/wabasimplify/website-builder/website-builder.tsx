
'use client';

import { useEffect, useState, useMemo } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { saveWebsitePage, getWebsitePages } from '@/app/actions/portfolio.actions';
import type { WithId, Website, WebsitePage, EcommProduct, WebsiteBlock, EcommShop, EcommPage } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { BlockPalette } from './block-palette';
import { Canvas } from './canvas';
import { PropertiesPanel } from './properties-panel';
import { PageManagerPanel } from './page-manager-panel';
import { Separator } from '@/components/ui/separator';
import { WebsiteBuilderHeader } from './website-builder-header';
import { saveEcommPage, getEcommPages, updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import { ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function findList(items: WebsiteBlock[], droppableId: string): WebsiteBlock[] | null {
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

export function WebsiteBuilder({ shop, initialPages, availableProducts }: { shop: WithId<EcommShop | Website>, initialPages: WithId<WebsitePage | EcommPage>[], availableProducts: WithId<EcommProduct>[] }) {
    const [pages, setPages] = useState<WithId<WebsitePage | EcommPage>[]>(initialPages);
    const [activeSurface, setActiveSurface] = useState<string>('');
    const [layout, setLayout] = useState<WebsiteBlock[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const homepage = pages.find(p => p.isHomepage) || pages[0];
        if (homepage) {
            setActiveSurface(homepage._id.toString());
            setLayout(homepage.layout || []);
        } else if (pages.length === 0) {
            const newHomePage: WebsiteBlock[] = [];
            const newPage: WithId<WebsitePage> = {
                _id: `temp_${uuidv4()}` as any,
                name: 'Home', slug: 'home', isHomepage: true, layout: newHomePage,
                siteId: shop._id,
                userId: 'userId' in shop ? shop.userId : (shop as any).projectId, // Fallback for ecomm
                createdAt: new Date(), updatedAt: new Date()
            };
            setPages([newPage]);
            setActiveSurface(newPage._id.toString());
            setLayout(newHomePage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activePage = useMemo(() => pages.find(p => p._id.toString() === activeSurface), [pages, activeSurface]);

    const handleSave = async () => {
        setIsSaving(true);
        let result;
        const isEcomm = !('userId' in shop);
        const saveAction = isEcomm ? saveEcommPage : saveWebsitePage;

        const isSitePart = !pages.some(p => p._id.toString() === activeSurface);

        if (isSitePart) {
            const formData = new FormData();
            formData.append('shopId', shop._id.toString());
            formData.append(`${activeSurface}Layout`, JSON.stringify(layout));
            result = await updateEcommShopSettings({}, formData);
        } else if (activePage) {
            result = await saveAction({
                pageId: activePage._id.toString().startsWith('temp_') ? undefined : activePage._id.toString(),
                shopId: shop._id.toString(), // For Ecomm
                siteId: shop._id.toString(), // For Portfolio
                name: activePage.name,
                slug: activePage.slug,
                layout: layout,
            });
        } else {
            toast({ title: 'Error', description: 'No active page to save.', variant: 'destructive' });
            setIsSaving(false);
            return;
        }

        if (result.error) {
            toast({ title: 'Error Saving', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success!', description: 'Your changes have been saved.' });
            fetchPages();
        }
        setIsSaving(false);
    };

    const fetchPages = async () => {
        if (!('userId' in shop)) { // It's an EcommShop
            const newPages = await getEcommPages(shop._id.toString());
            setPages(newPages);
        } else { // It's a portfolio Website
            const newPages = await getWebsitePages(shop._id.toString());
            setPages(newPages);
        }
    };

    const handleAddBlock = (type: WebsiteBlock['type']) => {
        const newBlock: WebsiteBlock = {
            id: uuidv4(), type, settings: {},
            ...(type === 'section' && { children: [] }),
        };

        if (type === 'columns') {
            const columnCount = 2;
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
        setActiveSurface(surfaceId);
        setSelectedBlockId(null);
        const page = pages.find(p => p._id.toString() === surfaceId);
        if (page) {
            setLayout(page.layout || []);
        } else {
            setLayout((shop as any)[`${surfaceId}Layout`] || []);
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

    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    const [isBlockPaletteOpen, setIsBlockPaletteOpen] = useState(false);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-screen w-screen bg-muted/20 flex flex-col overflow-hidden">
                <WebsiteBuilderHeader
                    site={shop}
                    pages={pages}
                    activeSurface={activeSurface}
                    onSwitchSurface={handleSelectSurface}
                    onSave={handleSave}
                    isSaving={isSaving}
                />

                <div className="flex-1 flex overflow-hidden relative">
                    {/* Main Canvas Area */}
                    <div className={cn(
                        "flex-1 bg-muted/10 overflow-y-auto w-full transition-all duration-300 relative custom-scrollbar",
                        rightPanelOpen && "mr-80"
                    )}>
                        <div className="max-w-5xl mx-auto min-h-full pb-32 pt-8 px-8">
                            <Canvas
                                layout={layout}
                                droppableId="canvas"
                                onBlockClick={(id) => { setSelectedBlockId(id); setRightPanelOpen(true); }}
                                selectedBlockId={selectedBlockId}
                                onRemoveBlock={handleRemoveBlock}
                                products={availableProducts}
                                shopSlug={(shop as WithId<EcommShop>).slug}
                                isEditable={true}
                            />
                        </div>
                    </div>

                    {/* FAB for Adding Blocks and Pages */}
                    <DropdownMenu open={isBlockPaletteOpen} onOpenChange={setIsBlockPaletteOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                className="absolute bottom-8 right-8 h-14 w-14 rounded-full shadow-2xl z-40 bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" className="w-80 h-[500px] overflow-y-auto p-0 z-50 rounded-xl shadow-2xl border bg-background/95 backdrop-blur-xl">
                            <div className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-md z-10">
                                <h3 className="font-semibold text-sm">Add Elements</h3>
                            </div>
                            <div className="p-4">
                                <BlockPalette onAddBlock={(type) => { handleAddBlock(type); setIsBlockPaletteOpen(false); }} />
                                <Separator className="my-4" />
                                <div className="text-xs font-semibold text-muted-foreground mb-2">PAGES & LAYOUT</div>
                                <PageManagerPanel pages={pages} activePageId={activePage?._id.toString() || ''} onSelectPage={handleSelectSurface} shopId={shop._id.toString()} onPagesUpdate={fetchPages} />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Right Panel - Properties */}
                    <div
                        className={cn(
                            "w-80 bg-background/80 backdrop-blur-xl border-l flex flex-col transition-all duration-300 ease-in-out absolute right-0 top-0 bottom-0 z-20 shadow-xl",
                            !rightPanelOpen && "translate-x-full opacity-0",
                        )}
                    >
                        <div className="flex items-center justify-between p-4 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">
                            <h3 className="font-semibold text-sm">Properties</h3>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setRightPanelOpen(false); setSelectedBlockId(null); }}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {selectedBlock ? (
                                <PropertiesPanel
                                    selectedBlock={selectedBlock}
                                    availableProducts={availableProducts}
                                    onUpdate={handleUpdateBlock}
                                    onRemove={handleRemoveBlock}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                                    <p className="text-sm">Select a block on the canvas to edit its properties.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
}

