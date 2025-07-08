
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextBlockRendererProps {
  settings: {
    htmlContent?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textTransform?: string;
    lineHeight?: string;
    letterSpacing?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
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
        'max-md:hidden lg:hidden': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const customAttributes = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;
    
    return (
        <div 
            id={settings.cssId} 
            className={cn("prose dark:prose-invert max-w-none", animationClass, responsiveClasses, settings.cssClasses)} 
            style={style}
            dangerouslySetInnerHTML={{ __html: settings.htmlContent || '' }}
            {...customAttributes}
        >
            {customStyleTag}
        </div>
    );
};
