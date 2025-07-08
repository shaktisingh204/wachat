
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
    droppableId?: string; 
    products: WithId<EcommProduct>[];
    onBlockClick?: (id: string) => void;
    onRemoveBlock?: (id: string) => void;
    selectedBlockId?: string | null;
    isNested?: boolean;
    shopSlug: string;
    isEditable?: boolean;
}

const EditableCanvas = ({ layout, droppableId, products, onBlockClick, onRemoveBlock, selectedBlockId, isNested, shopSlug }: CanvasProps & { droppableId: string, onBlockClick: (id: string) => void, onRemoveBlock: (id: string) => void }) => {
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
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn("relative group/block", snapshot.isDragging && "shadow-2xl opacity-90 z-50")}
                                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                                >
                                    <div 
                                        className={cn(
                                            "absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-0.5 bg-background border rounded-full shadow-md transition-opacity",
                                            selectedBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
                                        )}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div {...provided.dragHandleProps} className="p-1 cursor-grab rounded-full hover:bg-muted">
                                            <GripVertical className="h-4 w-4 text-muted-foreground"/>
                                        </div>
                                        <Separator orientation="vertical" className="h-4" />
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveBlock(block.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                    <div className={cn("outline-dashed outline-1 outline-transparent group-hover/block:outline-primary transition-all rounded-lg p-1", selectedBlockId === block.id && "outline-solid outline-2 outline-primary")}>
                                        <BlockRenderer block={block} products={products} shopSlug={shopSlug} isEditable={true} onBlockClick={onBlockClick} onRemoveBlock={onRemoveBlock} selectedBlockId={selectedBlockId} />
                                    </div>
                                </div>
                            )}
                        </Draggable>
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

const PublicCanvas = ({ layout, products, isNested, shopSlug }: CanvasProps) => {
    return (
        <div className={cn("w-full h-full", !isNested && "space-y-4")}>
            {layout.map((block) => (
                <BlockRenderer
                    key={block.id}
                    block={block}
                    products={products}
                    shopSlug={shopSlug}
                    isEditable={false}
                />
            ))}
        </div>
    );
}

export function Canvas(props: CanvasProps) {
    if (props.isEditable) {
        return <EditableCanvas {...props} droppableId={props.droppableId!} onBlockClick={props.onBlockClick!} onRemoveBlock={props.onRemoveBlock!} />;
    }
    return <PublicCanvas {...props} />;
}
