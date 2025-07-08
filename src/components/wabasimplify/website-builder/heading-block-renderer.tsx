
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function interpolate(text: string, variables: Record<string, any>): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/{{\s*([\w\d._]+)\s*}}/g, (match, key) => {
        const value = key.split('.').reduce((o: any, i: string) => o?.[i], variables);
        return value !== undefined ? String(value) : match;
    });
}

export function HeadingBlock({ settings, contextData }: { settings: any, contextData?: any }) {
    const Tag = settings.htmlTag || 'h2';
    const SubheadingTag = settings.subheadingHtmlTag || 'p';

    const responsiveAlignmentClasses = cn({
        'text-left': settings.textAlign === 'left',
        'text-center': settings.textAlign === 'center',
        'text-right': settings.textAlign === 'right',
        'text-justify': settings.textAlign === 'justify',
        'md:text-left': settings.tabletTextAlign === 'left',
        'md:text-center': settings.tabletTextAlign === 'center',
        'md:text-right': settings.tabletTextAlign === 'right',
        'sm:text-left': settings.mobileTextAlign === 'left',
        'sm:text-center': settings.mobileTextAlign === 'center',
        'sm:text-right': settings.mobileTextAlign === 'right',
    });

    const style: React.CSSProperties = {
        fontFamily: settings.fontFamily || 'inherit',
        fontSize: settings.fontSize ? `${settings.fontSize}px` : undefined,
        fontWeight: settings.fontWeight || 'normal',
        fontStyle: settings.fontStyle || 'normal',
        textTransform: settings.textTransform || 'none',
        lineHeight: settings.lineHeight || 'inherit',
        letterSpacing: settings.letterSpacing ? `${settings.letterSpacing}px` : undefined,
        color: settings.color || 'inherit',
        mixBlendMode: settings.blendMode || 'normal',
        textShadow: settings.textShadow ? `${settings.textShadow.x || 0}px ${settings.textShadow.y || 0}px ${settings.textShadow.blur || 0}px ${settings.textShadow.color || 'transparent'}` : 'none',
        margin: settings.margin ? `${settings.margin.top || 0}px ${settings.margin.right || 0}px ${settings.margin.bottom || 0}px ${settings.margin.left || 0}px` : undefined,
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const subheadingStyle: React.CSSProperties = {
        fontFamily: settings.subheading?.fontFamily || 'inherit',
        fontSize: settings.subheading?.fontSize ? `${settings.subheading.fontSize}px` : undefined,
        fontWeight: settings.subheading?.fontWeight || 'normal',
        color: settings.subheading?.color || 'inherit',
    };
    
    const animationClass = {
        fade: 'animate-fade-in',
        slide: 'animate-slide-in-up',
        zoom: 'animate-in zoom-in-50',
        bounce: 'animate-bounce',
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

    const headingText = interpolate(settings.text || 'Heading Text', contextData || {});
    const subheadingText = interpolate(settings.subheadingText || '', contextData || {});

    const headingContent = (
        <>
            {subheadingText && React.createElement(SubheadingTag, { style: subheadingStyle }, subheadingText)}
            {React.createElement(Tag, { style, className: cn(settings.size) }, headingText)}
        </>
    );
    
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
        <div id={settings.cssId} className={cn(animationClass, responsiveClasses, responsiveAlignmentClasses, settings.cssClasses)} {...customAttributes}>
            {customStyleTag}
            <WrapperElement>
                {headingContent}
            </WrapperElement>
        </div>
    );
};
