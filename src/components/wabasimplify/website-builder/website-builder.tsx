
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
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);

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
                    {/* Left Panel - Blocks & Pages */}
                    <div
                        className={cn(
                            "w-80 bg-background/80 backdrop-blur-xl border-r flex flex-col transition-all duration-300 ease-in-out absolute left-0 top-0 bottom-0 z-20 shadow-xl",
                            !leftPanelOpen && "-translate-x-full opacity-0"
                        )}
                    >
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <PageManagerPanel pages={pages} activePageId={activePage?._id.toString() || ''} onSelectPage={handleSelectSurface} shopId={shop._id.toString()} onPagesUpdate={fetchPages} />
                            <Separator className="my-6 bg-border/50" />
                            <BlockPalette onAddBlock={handleAddBlock} />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-8 top-4 bg-background border border-l-0 rounded-l-none shadow-md h-8 w-8 z-30 hover:bg-muted"
                            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                        >
                            {leftPanelOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Toggle Button for Left Panel when closed */}
                    {!leftPanelOpen && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-4 top-4 z-10 shadow-lg rounded-full h-10 w-10 bg-background/80 backdrop-blur-md border hover:bg-background"
                            onClick={() => setLeftPanelOpen(true)}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    )}

                    {/* Main Canvas Area */}
                    <div className={cn(
                        "flex-1 bg-muted/10 overflow-y-auto p-8 transition-all duration-300 relative",
                        leftPanelOpen && "ml-80",
                        rightPanelOpen && "mr-80"
                    )}>
                        <div className="max-w-5xl mx-auto min-h-full pb-20">
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

                    {/* Right Panel - Properties */}
                    <div
                        className={cn(
                            "w-80 bg-background/80 backdrop-blur-xl border-l flex flex-col transition-all duration-300 ease-in-out absolute right-0 top-0 bottom-0 z-20 shadow-xl",
                            !rightPanelOpen && "translate-x-full opacity-0",
                            !selectedBlockId && !rightPanelOpen && "translate-x-full"
                        )}
                    >
                        <div className="flex items-center justify-between p-4 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">
                            <h3 className="font-semibold text-sm">Properties</h3>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRightPanelOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <PropertiesPanel
                                selectedBlock={selectedBlock}
                                availableProducts={availableProducts}
                                onUpdate={handleUpdateBlock}
                                onRemove={handleRemoveBlock}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
}

