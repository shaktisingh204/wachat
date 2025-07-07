
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
  shopSlug: string;
  selectedBlockId?: string | null;
  onBlockClick?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  isEditable?: boolean;
}

export const SectionBlockRenderer: React.FC<SectionBlockRendererProps> = (props) => {
    const { settings, children, products, blockId, shopSlug, selectedBlockId, onBlockClick, onRemoveBlock, isEditable } = props;
    const safeSettings = settings || {};

    const style: React.CSSProperties = {
        paddingTop: `${safeSettings.padding?.top || 64}px`,
        paddingBottom: `${safeSettings.padding?.bottom || 64}px`,
        paddingLeft: `${safeSettings.padding?.left || 16}px`,
        paddingRight: `${safeSettings.padding?.right || 16}px`,
    };

    if (safeSettings.backgroundType === 'color') {
        style.backgroundColor = safeSettings.backgroundColor;
    } else if (safeSettings.backgroundType === 'image' && safeSettings.backgroundImageUrl) {
        style.backgroundImage = `url(${safeSettings.backgroundImageUrl})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
    }

    return (
        <section style={style}>
            <div 
                className={cn("mx-auto flex flex-col", safeSettings.width === 'boxed' ? 'max-w-7xl' : 'w-full')}
                style={{ gap: `${safeSettings.gap || 16}px` }}
            >
                <Canvas
                    layout={children}
                    droppableId={blockId}
                    products={products}
                    selectedBlockId={selectedBlockId}
                    onBlockClick={onBlockClick}
                    onRemoveBlock={onRemoveBlock}
                    isNested={true}
                    shopSlug={shopSlug}
                    isEditable={isEditable}
                />
            </div>
        </section>
    );
};
