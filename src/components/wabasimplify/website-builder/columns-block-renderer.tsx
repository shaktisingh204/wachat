
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { BlockRenderer } from './block-renderer';
import { Canvas } from './canvas';

interface ColumnsBlockRendererProps {
  settings: any;
  children: WebsiteBlock[];
  products: WithId<EcommProduct>[];
  blockId: string;
  selectedBlockId?: string | null;
  onBlockClick?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
}

export const ColumnsBlockRenderer: React.FC<ColumnsBlockRendererProps> = (props) => {
    const { settings, children, products, blockId, selectedBlockId, onBlockClick, onRemoveBlock } = props;
    const { columnCount = 2, gap = 4, stackOnMobile = true, padding } = settings;

    const gridColsClasses: {[key: number]: string} = {
        1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3',
        4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6',
    };
    
    const responsiveClass = stackOnMobile ? 'grid-cols-1' : `grid-cols-${columnCount}`;

    const style = {
        gap: `${gap}px`,
        padding: padding ? `${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px` : undefined,
    };

    return (
        <div className={cn('grid', responsiveClass, gridColsClasses[columnCount])} style={style}>
            {children.map(column => (
                <div key={column.id} className="flex flex-col">
                     <Canvas
                        layout={column.children || []}
                        droppableId={column.id}
                        products={products}
                        selectedBlockId={selectedBlockId}
                        onBlockClick={onBlockClick!}
                        onRemoveBlock={onRemoveBlock!}
                        isNested={true}
                    />
                </div>
            ))}
        </div>
    );
};
