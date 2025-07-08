
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { Canvas } from './canvas';

interface ColumnsBlockRendererProps {
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

export const ColumnsBlockRenderer: React.FC<ColumnsBlockRendererProps> = (props) => {
    const { settings, children, products, shopSlug, selectedBlockId, onBlockClick, onRemoveBlock, isEditable } = props;
    const safeSettings = settings || {};
    const { columnCount = 2, gap = 16, stackOnMobile = true, padding } = safeSettings;

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
            {children.map(column => {
                const columnSettings = column.settings || {};
                const HtmlTag = columnSettings.htmlTag || 'div';

                const columnStyle: React.CSSProperties = {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: columnSettings.verticalAlign || 'flex-start',
                    alignItems: columnSettings.horizontalAlign || 'stretch',
                    backgroundColor: columnSettings.backgroundColor,
                    backgroundImage: columnSettings.gradient ? `linear-gradient(${columnSettings.gradient.angle || 180}deg, ${columnSettings.gradient.color1 || '#FFFFFF'}, ${columnSettings.gradient.color2 || '#F0F0F0'})` : undefined,
                    padding: columnSettings.padding ? `${columnSettings.padding.top || 0}px ${columnSettings.padding.right || 0}px ${columnSettings.padding.bottom || 0}px ${columnSettings.padding.left || 0}px` : undefined,
                    margin: columnSettings.margin ? `${columnSettings.margin.top || 0}px ${columnSettings.margin.right || 0}px ${columnSettings.margin.bottom || 0}px ${columnSettings.margin.left || 0}px` : undefined,
                    borderStyle: columnSettings.border?.type,
                    borderColor: columnSettings.border?.color,
                    borderWidth: columnSettings.border?.width ? `${columnSettings.border.width}px` : undefined,
                    borderRadius: columnSettings.border?.radius ? `${columnSettings.border.radius}px` : undefined,
                    boxShadow: columnSettings.boxShadow,
                    zIndex: columnSettings.zIndex,
                };
                
                const animationClass = {
                    fade: 'animate-fade-in',
                    slide: 'animate-slide-in-up',
                }[columnSettings.animation || 'none'];
                
                const responsiveClasses = cn({
                    'max-md:hidden': columnSettings.visibility === 'desktop',
                    'hidden sm:max-md:hidden': columnSettings.visibility === 'tablet',
                    'hidden sm:flex': columnSettings.visibility === 'mobile',
                });
                
                const customAttributes = (columnSettings.customAttributes || []).reduce((acc: any, attr: any) => {
                    if(attr.key) acc[attr.key] = attr.value;
                    return acc;
                }, {});

                return React.createElement(HtmlTag, {
                        key: column.id,
                        id: columnSettings.cssId,
                        className: cn(animationClass, responsiveClasses, columnSettings.cssClasses),
                        style: columnStyle,
                        ...customAttributes,
                        onClick: isEditable ? (e: React.MouseEvent) => { e.stopPropagation(); onBlockClick?.(column.id); } : undefined,
                    }, 
                    <Canvas
                        layout={column.children || []}
                        droppableId={column.id}
                        products={products}
                        selectedBlockId={selectedBlockId}
                        onBlockClick={onBlockClick}
                        onRemoveBlock={onRemoveBlock}
                        isNested={true}
                        shopSlug={shopSlug}
                        isEditable={isEditable}
                    />
                );
            })}
        </div>
    );
};
