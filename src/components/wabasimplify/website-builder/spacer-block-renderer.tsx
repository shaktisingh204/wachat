
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SpacerBlockRendererProps {
  settings: {
    type?: 'spacer' | 'divider';
    height?: number;
    // Divider settings
    style?: 'solid' | 'dashed' | 'dotted';
    width?: string;
    thickness?: number;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
    // Advanced settings
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

export const SpacerBlockRenderer: React.FC<SpacerBlockRendererProps> = ({ settings }) => {
    const type = settings.type || 'spacer';
    
    const responsiveClasses = cn({
        'max-lg:hidden': settings.responsiveVisibility?.desktop === false,
        'max-md:hidden lg:hidden': settings.responsiveVisibility?.tablet === false,
        'max-sm:hidden': settings.responsiveVisibility?.mobile === false,
    });
    
    const animationClass = {
        fadeIn: 'animate-in fade-in duration-500',
        fadeInUp: 'animate-in fade-in-0 slide-in-from-bottom-5 duration-500',
    }[settings.animation || 'none'];

    const baseStyle: React.CSSProperties = {
        marginTop: settings.margin?.top ? `${settings.margin.top}px` : undefined,
        marginRight: settings.margin?.right ? `${settings.margin.right}px` : undefined,
        marginBottom: settings.margin?.bottom ? `${settings.margin.bottom}px` : undefined,
        marginLeft: settings.margin?.left ? `${settings.margin.left}px` : undefined,
        paddingTop: settings.padding?.top ? `${settings.padding.top}px` : undefined,
        paddingRight: settings.padding?.right ? `${settings.padding.right}px` : undefined,
        paddingBottom: settings.padding?.bottom ? `${settings.padding.bottom}px` : undefined,
        paddingLeft: settings.padding?.left ? `${settings.padding.left}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const customAttrs = (settings.customAttributes || []).reduce((acc: any, attr: any) => {
        if(attr.key) acc[attr.key] = attr.value;
        return acc;
    }, {});

    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;

    if (type === 'divider') {
        const dividerStyle: React.CSSProperties = {
            ...baseStyle,
            width: settings.width || '100%',
            borderTopStyle: settings.style || 'solid',
            borderTopWidth: `${settings.thickness || 1}px`,
            borderColor: settings.color || 'hsl(var(--border))',
        };
        
        const alignmentClass = {
            left: 'mr-auto',
            center: 'mx-auto',
            right: 'ml-auto',
        }[settings.alignment || 'center'];

        return (
            <>
                {customStyleTag}
                <hr 
                    id={settings.cssId} 
                    style={dividerStyle} 
                    className={cn(alignmentClass, responsiveClasses, animationClass, settings.cssClasses)} 
                    {...customAttrs} 
                />
            </>
        );
    }

    // Spacer
    const spacerStyle: React.CSSProperties = {
        ...baseStyle,
        height: `${settings.height || 24}px`,
    };

    return (
        <>
            {customStyleTag}
            <div 
                id={settings.cssId} 
                style={spacerStyle} 
                className={cn(responsiveClasses, animationClass, settings.cssClasses)} 
                {...customAttrs}
            ></div>
        </>
    );
};
