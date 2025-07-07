
'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlockRenderer } from './block-renderer';
import { Separator } from '@/components/ui/separator';
import React from 'react';

interface CanvasProps {
    layout: WebsiteBlock[];
    droppableId: string;
    products: WithId<EcommProduct>[];
    onBlockClick: (id: string) => void;
    onRemoveBlock: (id: string) => void;
    selectedBlockId: string | null;
    isNested?: boolean;
}

const CanvasBlockWrapper = ({ block, index, products, onBlockClick, onRemoveBlock, selectedBlockId }: {
    block: WebsiteBlock;
    index: number;
    products: WithId<EcommProduct>[];
    onBlockClick: (id: string) => void;
    onRemoveBlock: (id: string) => void;
    selectedBlockId: string | null;
}) => {
    const isSelected = selectedBlockId === block.id;

    const layoutStyle: React.CSSProperties = {
        width: block.settings?.layout?.width,
        height: block.settings?.layout?.height,
        maxWidth: block.settings?.layout?.maxWidth,
        minHeight: block.settings?.layout?.minHeight,
        overflow: block.settings?.layout?.overflow as any,
    };

    return (
        <Draggable draggableId={block.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "relative group/block",
                        snapshot.isDragging && "shadow-2xl opacity-90 z-50"
                    )}
                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                    style={layoutStyle}
                >
                    <div 
                        className={cn(
                            "absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-0.5 bg-background border rounded-full shadow-md transition-opacity",
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
                        )}
                        onClick={e => e.stopPropagation()} // Prevent deselection when interacting with controls
                    >
                        <div {...provided.dragHandleProps} className="p-1 cursor-grab rounded-full hover:bg-muted">
                            <GripVertical className="h-4 w-4 text-muted-foreground"/>
                        </div>
                        <Separator orientation="vertical" className="h-4" />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveBlock(block.id)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    </div>

                    <div className={cn(
                        "outline-dashed outline-1 outline-transparent group-hover/block:outline-primary transition-all rounded-lg",
                        isSelected && "outline-solid outline-2 outline-primary",
                    )}>
                        <BlockRenderer
                            block={block}
                            products={products}
                            selectedBlockId={selectedBlockId}
                            onBlockClick={onBlockClick}
                            onRemoveBlock={onRemoveBlock}
                        />
                    </div>
                </div>
            )}
        </Draggable>
    );
};


export function Canvas({ layout, droppableId, products, onBlockClick, onRemoveBlock, selectedBlockId, isNested = false }: CanvasProps) {
    return (
        <Droppable droppableId={droppableId} type="BLOCK">
            {(provided, snapshot) => (
                <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                        "space-y-4 rounded-lg w-full h-full transition-colors",
                        !isNested && "p-4",
                        isNested && "min-h-[200px]",
                        snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary ring-dashed"
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
