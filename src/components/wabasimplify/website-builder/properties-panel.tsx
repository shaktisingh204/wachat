
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
    return (
        <WebsiteBlockEditor
            selectedBlock={selectedBlock}
            availableProducts={availableProducts}
            onUpdate={onUpdate}
            onRemove={onRemove}
        />
    );
}
