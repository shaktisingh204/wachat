
'use client';

import { useEffect, useState, useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

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

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        // For sortable reordering within the same list
        const oldIndex = layout.findIndex(b => b.id === active.id);
        const newIndex = layout.findIndex(b => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            setLayout(arrayMove(layout, oldIndex, newIndex));
        }
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {/* Root Container: Full Viewport, Fixed Layout */}
            <div className="flex flex-col h-screen w-full bg-[#FAFAFA] dark:bg-zinc-950 overflow-hidden relative">
                <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                {/* 1. Header (Fixed at top) */}
                <div className="flex-none z-50 bg-background/70 backdrop-blur-md border-b sticky top-0 supports-[backdrop-filter]:bg-background/60">
                    <WebsiteBuilderHeader
                        site={shop}
                        pages={pages}
                        activeSurface={activeSurface}
                        onSwitchSurface={handleSelectSurface}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />
                </div>

                {/* 2. Main Content Area (Fills remaining height) */}
                <div className="flex-1 relative flex overflow-hidden z-10">

                    {/* A. Canvas Scroll Container (The ONLY thing that scrolls) */}
                    <div className="flex-1 h-full w-full overflow-y-auto overflow-x-hidden relative custom-scrollbar bg-transparent">
                        <div className="min-h-full w-full max-w-[1200px] mx-auto p-8 pb-32 flex flex-col items-center">
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

                    {/* B. FAB (Floating Action Button) - Absolute Overlay */}
                    <DropdownMenu open={isBlockPaletteOpen} onOpenChange={setIsBlockPaletteOpen}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="icon"
                                className="absolute bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl z-50 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-primary/25 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/10"
                            >
                                <Plus className="h-7 w-7" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" side="top" className="w-80 h-[500px] overflow-y-auto p-0 z-50 rounded-xl shadow-2xl border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                            <div className="p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
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

                    {/* C. Properties Panel (Overlay Sidebar) */}
                    {/* Fixed position relative to Main Content Area, high Z-index */}
                    <div
                        className={cn(
                            "absolute top-0 right-0 bottom-0 z-40 bg-background/80 backdrop-blur-2xl border-l shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-cubic-bezier(0.4, 0, 0.2, 1) flex flex-col",
                            "w-[400px] lg:w-[40%]", // Responsive width: fixed on small, % on large
                            !rightPanelOpen && "translate-x-full pointer-events-none"
                        )}
                    >
                        <div className="flex items-center justify-between p-4 border-b bg-transparent sticky top-0 z-10">
                            <h3 className="font-semibold text-sm">Properties</h3>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full" onClick={() => { setRightPanelOpen(false); setSelectedBlockId(null); }}>
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
        </DndContext>
    );
}
