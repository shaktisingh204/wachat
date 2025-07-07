
'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, LayoutGrid } from 'lucide-react';
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

const CanvasBlockWrapper = ({ block, index, products, onBlockClick, onRemoveBlock, selectedBlockId }: {
    block: WebsiteBlock;
    index: number;
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
                        "relative group transition-all p-1",
                        selectedBlockId === block.id && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg",
                        snapshot.isDragging && "shadow-2xl opacity-90"
                    )}
                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                >
                    <div className="absolute top-2 right-2 z-20 p-1 bg-background border rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <div {...provided.dragHandleProps} className="p-1 cursor-grab text-muted-foreground hover:text-foreground">
                            <GripVertical className="h-4 w-4"/>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id)}}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    </div>

                    <div className="pointer-events-none">
                         {block.type === 'section' || block.type === 'columns' ? (
                            <BlockRenderer block={block} products={products} >
                                <div className={cn("p-4", block.type === 'section' && 'border-t')}>
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
                        "p-4 space-y-4 min-h-[200px] rounded-lg",
                        snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary ring-dashed"
                    )}
                >
                    {layout.map((block, index) => (
                        <CanvasBlockWrapper
                            key={block.id}
                            block={block}
                            index={index}
                            products={products}
                            onBlockClick={onBlockClick}
                            onRemoveBlock={onRemoveBlock}
                            selectedBlockId={selectedBlockId}
                        />
                    ))}
                    {provided.placeholder}
                    {layout.length === 0 && !snapshot.isDraggingOver && (
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
