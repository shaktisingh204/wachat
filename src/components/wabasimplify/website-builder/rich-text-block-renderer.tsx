

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextBlockRendererProps {
  settings: {
    htmlContent?: string;
    htmlTag?: string;
    dropCap?: boolean;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textTransform?: string;
    lineHeight?: string;
    letterSpacing?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    blendMode?: string;
    textShadow?: { x?: number, y?: number, blur?: number, color?: string };
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    zIndex?: number;
    animation?: 'none' | 'fadeIn' | 'fadeInUp';
    responsiveVisibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
    cssId?: string;
    cssClasses?: string;
    customCss?: string;
    customAttributes?: {id: string, key: string, value: string}[];
  };
}

export const RichTextBlockRenderer: React.FC<RichTextBlockRendererProps> = ({ settings }) => {
    const Tag = settings.htmlTag || 'div';
    
    const style: React.CSSProperties = {
        fontFamily: settings.fontFamily || 'inherit',
        fontSize: settings.fontSize ? `${settings.fontSize}px` : undefined,
        fontWeight: settings.fontWeight || 'normal',
        fontStyle: settings.fontStyle || 'normal',
        textTransform: settings.textTransform || 'none',
        lineHeight: settings.lineHeight || 'inherit',
        letterSpacing: settings.letterSpacing ? `${settings.letterSpacing}px` : undefined,
        color: settings.color || 'inherit',
        textAlign: settings.textAlign || 'left',
        mixBlendMode: settings.blendMode as any || 'normal',
        textShadow: settings.textShadow ? `${settings.textShadow.x || 0}px ${settings.textShadow.y || 0}px ${settings.textShadow.blur || 0}px ${settings.textShadow.color || 'transparent'}` : 'none',
        margin: settings.margin ? `${settings.margin.top || 0}px ${settings.margin.right || 0}px ${settings.margin.bottom || 0}px ${settings.margin.left || 0}px` : undefined,
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
    }[settings.animation || 'none'];
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'hidden md:max-lg:flex': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;
    
    return React.createElement(Tag, {
        id: settings.cssId,
        className: cn(
            "prose dark:prose-invert max-w-none",
            settings.dropCap && "has-drop-cap",
            animationClass,
            responsiveClasses,
            settings.cssClasses
        ),
        style: style,
        dangerouslySetInnerHTML: { __html: settings.htmlContent || '' },
        ...customAttributes
    }, customStyleTag);
};
