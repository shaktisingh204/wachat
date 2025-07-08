
'use client';

import React from 'react';
import { WebsiteBlock, EcommProduct, WithId } from '@/lib/definitions';
import { cn } from '@/lib/utils';
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
    const HtmlTag = safeSettings.htmlTag || 'section';

    const sectionStyle: React.CSSProperties = {
        paddingTop: safeSettings.padding?.top ? `${safeSettings.padding.top}px` : undefined,
        paddingBottom: safeSettings.padding?.bottom ? `${safeSettings.padding.bottom}px` : undefined,
        paddingLeft: safeSettings.padding?.left ? `${safeSettings.padding.left}px` : undefined,
        paddingRight: safeSettings.padding?.right ? `${safeSettings.padding.right}px` : undefined,
        marginTop: safeSettings.margin?.top ? `${safeSettings.margin.top}px` : undefined,
        marginRight: safeSettings.margin?.right ? `${safeSettings.margin.right}px` : undefined,
        marginBottom: safeSettings.margin?.bottom ? `${safeSettings.margin.bottom}px` : undefined,
        marginLeft: safeSettings.margin?.left ? `${safeSettings.margin.left}px` : undefined,
        zIndex: safeSettings.zIndex || undefined,
        minHeight: safeSettings.heightMode === 'minHeight' ? `${safeSettings.minHeight || 50}vh` : undefined,
        height: safeSettings.heightMode === 'fitToScreen' ? '100vh' : undefined,
        overflow: safeSettings.overflow || 'visible',
        position: safeSettings.sticky === 'top' ? 'sticky' : 'relative',
        top: safeSettings.sticky === 'top' ? 0 : undefined,
        display: 'flex',
    };
    
    // Background styles
    if (safeSettings.backgroundType === 'classic') {
        if (safeSettings.backgroundColor) {
            sectionStyle.backgroundColor = safeSettings.backgroundColor;
        }
        if (safeSettings.backgroundImageUrl) {
            sectionStyle.backgroundImage = `url(${safeSettings.backgroundImageUrl})`;
            sectionStyle.backgroundSize = safeSettings.backgroundSize || 'cover';
            sectionStyle.backgroundPosition = safeSettings.backgroundPosition || 'center center';
            sectionStyle.backgroundRepeat = safeSettings.backgroundRepeat || 'no-repeat';
            sectionStyle.backgroundAttachment = safeSettings.backgroundAttachment || 'scroll';
        }
    }
    
    // Border styles
    if (safeSettings.border?.type && safeSettings.border.type !== 'none') {
        sectionStyle.borderStyle = safeSettings.border.type;
        sectionStyle.borderColor = safeSettings.border.color || '#000000';
        if (safeSettings.border.width) {
            sectionStyle.borderTopWidth = `${safeSettings.border.width.top || 0}px`;
            sectionStyle.borderRightWidth = `${safeSettings.border.width.right || 0}px`;
            sectionStyle.borderBottomWidth = `${safeSettings.border.width.bottom || 0}px`;
            sectionStyle.borderLeftWidth = `${safeSettings.border.width.left || 0}px`;
        }
        if(safeSettings.border.radius) {
            sectionStyle.borderRadius = `${safeSettings.border.radius.tl || 0}px ${safeSettings.border.radius.tr || 0}px ${safeSettings.border.radius.br || 0}px ${safeSettings.border.radius.bl || 0}px`;
        }
    }

    const shadowClasses = {
        none: '',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
    };
    const shadowClass = shadowClasses[safeSettings.boxShadow as keyof typeof shadowClasses] || '';

    const alignmentClasses = {
        top: 'items-start',
        middle: 'items-center',
        bottom: 'items-end',
    }[safeSettings.verticalAlign || 'top'];
    
    const responsiveClasses = cn({
        'hidden': safeSettings.responsiveVisibility?.desktop === false,
        'md:hidden': safeSettings.responsiveVisibility?.tablet === false,
        'sm:hidden': safeSettings.responsiveVisibility?.mobile === false,
    });

    const innerContainerStyle: React.CSSProperties = {
        width: '100%',
        maxWidth: safeSettings.width === 'boxed' ? `${safeSettings.boxedWidth || 1280}px` : '100%',
        margin: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: `${safeSettings.gap || 16}px`,
        position: 'relative',
        zIndex: 1,
    };
    
    // Scoped CSS for custom styles
    const customStyleTag = safeSettings.customCss ? (
        <style>{`#${blockId} { ${safeSettings.customCss} }`}</style>
    ) : null;

    return React.createElement(HtmlTag, {
        id: safeSettings.cssId || blockId,
        className: cn('w-full', alignmentClasses, responsiveClasses, shadowClass, safeSettings.cssClasses),
        style: sectionStyle,
    },
    <>
        {customStyleTag}
        <div style={innerContainerStyle}>
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
    </>
    );
};
