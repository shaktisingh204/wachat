
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function HeadingBlock({ settings }: { settings: any }) {
    const Tag = settings.htmlTag || 'h2';

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
        textShadow: settings.textShadow ? `${settings.textShadow.x || 0}px ${settings.textShadow.y || 0}px ${settings.textShadow.blur || 0}px ${settings.textShadow.color || 'transparent'}` : 'none',
        margin: settings.margin ? `${settings.margin.top || 0}px ${settings.margin.right || 0}px ${settings.margin.bottom || 0}px ${settings.margin.left || 0}px` : undefined,
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const animationClass = {
        fade: 'animate-fade-in',
        slide: 'animate-slide-in-up',
        zoom: 'animate-in zoom-in-50',
        bounce: 'animate-bounce',
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

    const headingContent = React.createElement(Tag, {
        style,
        className: cn(animationClass, responsiveClasses, settings.cssClasses),
        ...customAttributes
    }, settings.text || 'Heading Text');
    
    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;

    const WrapperElement = ({ children }: { children: React.ReactNode }) => {
        if (settings.link) {
            return <Link href={settings.link}>{children}</Link>;
        }
        return <>{children}</>;
    };

    return (
        <div id={settings.cssId}>
            {customStyleTag}
            <WrapperElement>
                {headingContent}
            </WrapperElement>
        </div>
    );
};
