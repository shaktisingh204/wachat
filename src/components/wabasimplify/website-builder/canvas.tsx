
'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BlockRenderer } from './block-renderer';
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
    contextData?: any;
}

const EditableCanvas = ({ layout, droppableId, products, onBlockClick, onRemoveBlock, selectedBlockId, isNested, shopSlug, contextData }: CanvasProps & { droppableId: string, onBlockClick: (id: string) => void, onRemoveBlock: (id: string) => void }) => {
    return (
        <Droppable droppableId={droppableId} type="BLOCK">
            {(provided, snapshot) => (
                <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                        "space-y-4 rounded-xl w-full h-full transition-all duration-300",
                        !isNested && "p-4",
                        isNested && "min-h-[100px]",
                        snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/20 ring-dashed"
                    )}
                >
                    {layout.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={cn("relative group/block transition-all duration-200", snapshot.isDragging && "shadow-2xl opacity-90 z-50 scale-[1.02]")}
                                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                                >
                                    <div
                                        className={cn(
                                            "absolute -top-3 left-1/2 -translate-x-1/2 z-[32] flex items-center gap-1 p-1 pr-1.5 pl-1.5 bg-foreground/90 backdrop-blur-sm text-background rounded-full shadow-lg transition-all duration-200 scale-90",
                                            selectedBlockId === block.id ? 'opacity-100 scale-100' : 'opacity-0 group-hover/block:opacity-100 group-hover/block:scale-100 translate-y-2 group-hover/block:translate-y-0'
                                        )}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div {...provided.dragHandleProps} className="p-1 cursor-grab rounded-full hover:bg-white/20 active:cursor-grabbing">
                                            <GripVertical className="h-3.5 w-3.5" />
                                        </div>
                                        <Separator orientation="vertical" className="h-3 bg-white/20" />
                                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-red-500/20 hover:text-red-400 text-red-300" onClick={() => onRemoveBlock(block.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className={cn("outline-dashed outline-2 outline-transparent group-hover/block:outline-primary/50 transition-all rounded-lg p-0.5", selectedBlockId === block.id && "outline-solid outline-2 outline-primary shadow-sm")}>
                                        <BlockRenderer block={block} products={products} shopSlug={shopSlug} isEditable={true} onBlockClick={onBlockClick} onRemoveBlock={onRemoveBlock} selectedBlockId={selectedBlockId} contextData={contextData} />
                                    </div>
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                    {layout.length === 0 && !snapshot.isDraggingOver && !isNested && (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/30 border-muted-foreground/20 text-center animate-in fade-in duration-500">
                            <div className="h-16 w-16 mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="font-semibold text-lg">Start building your page</h3>
                            <p className="mt-1 text-sm text-muted-foreground max-w-sm">Drag and drop blocks from the (+) menu to create your layout.</p>
                        </div>
                    )}
                </div>
            )}
        </Droppable>
    );
}

const PublicCanvas = ({ layout, products, isNested, shopSlug, contextData }: CanvasProps) => {
    return (
        <div className={cn("w-full h-full", !isNested && "space-y-4")}>
            {layout.map((block) => (
                <BlockRenderer
                    key={block.id}
                    block={block}
                    products={products}
                    shopSlug={shopSlug}
                    isEditable={false}
                    contextData={contextData}
                />
            ))}
        </div>
    );
}

export function Canvas(props: CanvasProps) {
    if (props.isEditable) {
        // The type assertion for onBlockClick and onRemoveBlock is safe because they are guaranteed to exist when isEditable is true.
        return <EditableCanvas {...props} droppableId={props.droppableId!} onBlockClick={props.onBlockClick!} onRemoveBlock={props.onRemoveBlock!} />;
    }
    return <PublicCanvas {...props} />;
}
