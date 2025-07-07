
'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Canvas } from './canvas';

interface SectionBlockRendererProps {
  settings: any;
  children: WebsiteBlock[];
  products: WithId<EcommProduct>[];
  blockId: string;
  selectedBlockId?: string | null;
  onBlockClick?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
}

export const SectionBlockRenderer: React.FC<SectionBlockRendererProps> = ({ settings, children, products, blockId, selectedBlockId, onBlockClick, onRemoveBlock }) => {
    const style: React.CSSProperties = {
        paddingTop: `${settings.padding?.top || 64}px`,
        paddingBottom: `${settings.padding?.bottom || 64}px`,
        paddingLeft: `${settings.padding?.left || 16}px`,
        paddingRight: `${settings.padding?.right || 16}px`,
    };

    if (settings.backgroundType === 'color') {
        style.backgroundColor = settings.backgroundColor;
    } else if (settings.backgroundType === 'image' && settings.backgroundImageUrl) {
        style.backgroundImage = `url(${settings.backgroundImageUrl})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
    }

    return (
        <section style={style}>
            <div 
                className={cn("mx-auto flex flex-col", settings.width === 'boxed' ? 'max-w-7xl' : 'w-full')}
                style={{ gap: `${settings.gap || 16}px` }}
            >
                <Canvas
                    layout={children}
                    droppableId={blockId}
                    products={products}
                    selectedBlockId={selectedBlockId}
                    onBlockClick={onBlockClick!}
                    onRemoveBlock={onRemoveBlock!}
                    isNested={true}
                />
            </div>
        </section>
    );
};
