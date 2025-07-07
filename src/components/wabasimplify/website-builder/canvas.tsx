
'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, LayoutGrid, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockRenderer } from './block-renderer';

interface CanvasProps {
    layout: WebsiteBlock[];
    droppableId: string;
    products: WithId<EcommProduct>[];
    onBlockClick: (id: string) => void;
    onRemoveBlock: (id: string) => void;
    selectedBlockId: string | null;
}

const CanvasBlockWrapper = ({ block, index, parentId, products, onBlockClick, onRemoveBlock, selectedBlockId }: {
    block: WebsiteBlock;
    index: number;
    parentId: string;
    products: WithId<EcommProduct>[];
    onBlockClick: (id: string) => void;
    onRemoveBlock: (id: string) => void;
    selectedBlockId: string | null;
}) => {
    return (
        <Draggable draggableId={block.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "relative group transition-all",
                        selectedBlockId === block.id && "ring-2 ring-primary ring-offset-2 ring-offset-muted",
                        snapshot.isDragging && "shadow-2xl opacity-90"
                    )}
                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 p-1 bg-background border rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <div {...provided.dragHandleProps} className="p-1 cursor-grab text-muted-foreground hover:text-foreground">
                            <GripVertical className="h-5 w-5"/>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onBlockClick(block.id)}}>
                            <Settings2 className="h-4 w-4 text-primary"/>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id)}}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    </div>

                    <div className="pointer-events-none">
                         {block.type === 'section' ? (
                            <BlockRenderer block={block} products={products} >
                                <div className="p-4 border-t">
                                    <Canvas
                                        layout={block.children || []}
                                        droppableId={block.id}
                                        selectedBlockId={selectedBlockId}
                                        onBlockClick={onBlockClick}
                                        onRemoveBlock={onRemoveBlock}
                                        products={products}
                                    />
                                </div>
                            </BlockRenderer>
                         ) : block.type === 'columns' ? (
                            <BlockRenderer block={block} products={products} >
                                {(block.children || []).map(column => (
                                    <div key={column.id} className="bg-muted/30 rounded-md">
                                        <Canvas
                                            layout={column.children || []}
                                            droppableId={column.id}
                                            selectedBlockId={selectedBlockId}
                                            onBlockClick={onBlockClick}
                                            onRemoveBlock={onRemoveBlock}
                                            products={products}
                                        />
                                    </div>
                                ))}
                            </BlockRenderer>
                         ) : (
                            <BlockRenderer block={block} products={products} />
                         )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};


export function Canvas({ layout, droppableId, products, onBlockClick, onRemoveBlock, selectedBlockId }: CanvasProps) {
    return (
        <Droppable droppableId={droppableId} type="BLOCK">
            {(provided, snapshot) => (
                <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                        "p-4 space-y-4 min-h-[10rem] rounded-lg",
                        snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary ring-dashed"
                    )}
                >
                    {layout.map((block, index) => (
                        <CanvasBlockWrapper
                            key={block.id}
                            block={block}
                            index={index}
                            parentId={droppableId}
                            products={products}
                            onBlockClick={onBlockClick}
                            onRemoveBlock={onRemoveBlock}
                            selectedBlockId={selectedBlockId}
                        />
                    ))}
                    {provided.placeholder}
                    {layout.length === 0 && (
                        <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                            <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground/50"/>
                            <p className="mt-2 text-sm">Drop blocks here</p>
                        </div>
                    )}
                </div>
            )}
        </Droppable>
    );
}
