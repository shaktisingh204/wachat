

'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Trash2, GripVertical, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BlockPreview = ({ block }: { block: WebsiteBlock }) => {
    switch (block.type) {
        case 'hero':
            return <p className="text-sm text-muted-foreground">Hero: {block.settings.title || 'Untitled'}</p>;
        case 'section':
             return <p className="text-sm text-muted-foreground">Section</p>;
        case 'columns':
             return <p className="text-sm text-muted-foreground">Columns ({block.children?.length || 0})</p>;
        case 'featuredProducts':
            return <p className="text-sm text-muted-foreground">Products: {(block.settings.productIds || []).length} items</p>;
        case 'richText':
             return <p className="text-sm text-muted-foreground line-clamp-2">{block.settings.htmlContent?.replace(/<[^>]*>?/gm, '') || 'Rich Text Content...'}</p>;
        default:
            return <p className="text-sm text-muted-foreground">{block.type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</p>;
    }
};

interface CanvasProps {
    layout: WebsiteBlock[];
    droppableId: string;
    onBlockClick: (id: string) => void;
    onRemoveBlock: (parentId: string, index: number) => void;
    selectedBlockId: string | null;
}

export function Canvas({ layout, droppableId, onBlockClick, onRemoveBlock, selectedBlockId }: CanvasProps) {
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
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    onClick={(e) => { e.stopPropagation(); onBlockClick(block.id); }}
                                    className={cn(
                                        "bg-background border rounded-lg hover:shadow-lg transition-all",
                                        selectedBlockId === block.id && "ring-2 ring-primary shadow-xl",
                                        snapshot.isDragging && "shadow-2xl opacity-80"
                                    )}
                                >
                                     <div className="flex items-center justify-between p-2 pl-1 bg-slate-50 border-b rounded-t-lg">
                                        <div {...provided.dragHandleProps} className="p-2 cursor-grab">
                                            <GripVertical className="h-5 w-5 text-muted-foreground"/>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <BlockPreview block={block} />
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRemoveBlock(droppableId, index)}}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                    
                                    {block.type === 'section' && (
                                      <div className="p-4 border-t">
                                        <Canvas
                                          layout={block.children || []}
                                          droppableId={block.id}
                                          selectedBlockId={selectedBlockId}
                                          onBlockClick={onBlockClick}
                                          onRemoveBlock={onRemoveBlock}
                                        />
                                      </div>
                                    )}
                                     {block.type === 'columns' && (
                                        <div
                                            className="grid p-2 gap-2"
                                            style={{ gridTemplateColumns: `repeat(${block.settings.columnCount || 2}, 1fr)` }}
                                        >
                                            {(block.children || []).map(column => (
                                            <div key={column.id} className="bg-muted/50 rounded-md">
                                                <Canvas
                                                    layout={column.children || []}
                                                    droppableId={column.id}
                                                    selectedBlockId={selectedBlockId}
                                                    onBlockClick={onBlockClick}
                                                    onRemoveBlock={onRemoveBlock}
                                                />
                                            </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Draggable>
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
