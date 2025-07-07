
'use client';

import { Droppable, Draggable } from 'react-beautiful-dnd';
import { WebsiteBlock } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BlockPreview = ({ block }: { block: WebsiteBlock }) => {
    switch (block.type) {
        case 'hero':
            return <div className="p-4 text-center">
                <h3 className="font-bold text-lg">{block.settings.title || 'Hero Section'}</h3>
                <p className="text-sm text-muted-foreground">{block.settings.subtitle || 'Click to edit'}</p>
            </div>;
        case 'featuredProducts':
            return <div className="p-4 text-center">
                <h3 className="font-bold text-lg">{block.settings.title || 'Featured Products'}</h3>
                <p className="text-sm text-muted-foreground">{(block.settings.productIds || []).length} products selected</p>
            </div>;
        case 'richText':
             return <div className="p-4"><p className="text-sm text-muted-foreground line-clamp-2">{block.settings.htmlContent?.replace(/<[^>]*>?/gm, '') || 'Rich Text Content...'}</p></div>;
        case 'testimonials':
             return <div className="p-4"><p className="text-sm text-muted-foreground">{(block.settings.testimonials || []).length} testimonials</p></div>;
        case 'faq':
             return <div className="p-4"><p className="text-sm text-muted-foreground">{(block.settings.faqItems || []).length} FAQ items</p></div>;
        case 'customHtml':
             return <div className="p-4"><p className="text-sm text-muted-foreground font-mono">Custom HTML Block</p></div>;
        default:
            return <p>Unknown Block</p>;
    }
};

interface CanvasProps {
    layout: WebsiteBlock[];
    setSelectedBlockId: (id: string | null) => void;
    selectedBlockId: string | null;
}

export function Canvas({ layout, setSelectedBlockId, selectedBlockId }: CanvasProps) {
    return (
        <Droppable droppableId="canvas">
            {(provided, snapshot) => (
                <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={cn(
                        "p-4 md:p-8 space-y-4 min-h-full",
                        snapshot.isDraggingOver && "bg-primary/5"
                    )}
                >
                    {layout.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => setSelectedBlockId(block.id)}
                                    className={cn(
                                        "bg-background border rounded-lg hover:shadow-lg transition-all",
                                        selectedBlockId === block.id && "ring-2 ring-primary shadow-xl",
                                        snapshot.isDragging && "shadow-2xl opacity-80"
                                    )}
                                >
                                    <BlockPreview block={block} />
                                </div>
                            )}
                        </Draggable>
                    ))}
                    {provided.placeholder}
                    {layout.length === 0 && (
                        <div className="text-center text-muted-foreground py-24 border-2 border-dashed rounded-lg">
                            <p>Add blocks from the left panel to build your page.</p>
                        </div>
                    )}
                </div>
            )}
        </Droppable>
    );
}
