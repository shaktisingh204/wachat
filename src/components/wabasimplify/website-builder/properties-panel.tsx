
'use client';

import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { WebsiteBlockEditor } from './website-block-editor';

interface PropertiesPanelProps {
    selectedBlock: WebsiteBlock | undefined;
    availableProducts: WithId<EcommProduct>[];
    onUpdate: (id: string, newSettings: any) => void;
    onRemove: (id: string) => void;
}

export function PropertiesPanel({ selectedBlock, availableProducts, onUpdate, onRemove }: PropertiesPanelProps) {
    if (!selectedBlock) {
        return (
            <div className="text-center text-muted-foreground p-8">
                <p>Select a block on the canvas to edit its properties.</p>
            </div>
        );
    }
    return (
        <WebsiteBlockEditor
            block={selectedBlock}
            onUpdate={onUpdate}
            onRemove={onRemove}
            availableProducts={availableProducts}
            isDragging={false} // This prop is not needed here
        />
    );
}
