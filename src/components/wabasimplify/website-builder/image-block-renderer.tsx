
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function ImageBlockRenderer({ settings }: { settings: any }) {
    const Tag = settings.htmlTag || 'div';
    const alignClasses = {
        left: 'justify-start',
        center: 'justify-center',
        right: 'justify-end',
    }[settings.align || 'center'];

    const wrapperStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: alignClasses,
        margin: settings.margin ? `${settings.margin.top || 0}px ${settings.margin.right || 0}px ${settings.margin.bottom || 0}px ${settings.margin.left || 0}px` : undefined,
        padding: settings.padding ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px` : undefined,
        zIndex: settings.zIndex || undefined,
    };
    
    const figureStyle: React.CSSProperties = {
        width: settings.width || undefined,
        maxWidth: settings.maxWidth || '100%',
    };

    const imageStyle: React.CSSProperties = {
        height: settings.height || 'auto',
        objectFit: settings.objectFit || 'cover',
        opacity: settings.opacity ?? 1,
        borderRadius: settings.borderRadius ? `${settings.borderRadius}px` : undefined,
        transition: `all ${settings.transitionDuration || 0.3}s ease-in-out`,
        filter: [
            `blur(${settings.filter?.blur || 0}px)`,
            `brightness(${settings.filter?.brightness || 100}%)`,
            `contrast(${settings.filter?.contrast || 100}%)`,
            `saturate(${settings.filter?.saturate || 100}%)`,
        ].join(' '),
    };

    if (settings.border?.type && settings.border.type !== 'none') {
        imageStyle.borderStyle = settings.border.type;
        imageStyle.borderColor = settings.border.color || '#000000';
        imageStyle.borderWidth = `${settings.border.width || 1}px`;
    }
    
    const shadowClasses = { none: '', sm: 'shadow-sm', md: 'shadow-md', lg: 'shadow-lg' }[settings.shadow || 'none'];
    const hoverClasses = {
        none: '',
        zoom: 'group-hover:scale-105',
        grow: 'group-hover:scale-110',
        shrink: 'group-hover:scale-95',
    }[settings.hoverAnimation || 'none'];

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

    const ImageElement = (
        <Image
            src={settings.src || 'https://placehold.co/600x400.png'}
            alt={settings.alt || 'Website image'}
            width={800} // Base width for quality, will be controlled by CSS
            height={600}
            className={cn('w-full', hoverClasses)}
            style={imageStyle}
            loading={settings.lazyLoad === false ? 'eager' : 'lazy'}
            data-ai-hint="shop image"
        />
    );
    
    const CaptionElement = settings.caption ? (
        <figcaption
            className="text-center"
            style={{
                color: settings.captionStyle?.color || 'inherit',
                fontFamily: settings.captionStyle?.fontFamily || 'inherit',
                fontSize: settings.captionStyle?.fontSize ? `${settings.captionStyle.fontSize}px` : undefined,
                fontWeight: settings.captionStyle?.fontWeight || 'normal',
                marginTop: settings.captionStyle?.spacing ? `${settings.captionStyle.spacing}px` : undefined,
            }}
        >
            {settings.caption}
        </figcaption>
    ) : null;

    const content = (
        <>
            {ImageElement}
            {Tag === 'figure' && CaptionElement}
        </>
    );

    const customStyleTag = settings.customCss ? (
        <style>{`#${settings.cssId || ''} { ${settings.customCss} }`}</style>
    ) : null;

    const WrapperElement = ({ children }: { children: React.ReactNode }) => {
        if (settings.link) {
            const rel = settings.linkNofollow ? 'nofollow' : undefined;
            return <Link href={settings.link} target={settings.linkNewTab ? '_blank' : '_self'} rel={rel}>{children}</Link>;
        }
        return <>{children}</>;
    };

    return (
        <div id={settings.cssId} style={wrapperStyle} className={cn('relative', animationClass, responsiveClasses, settings.cssClasses)} {...customAttributes}>
            {customStyleTag}
            <Tag style={figureStyle} className={cn('group space-y-2', shadowClasses)}>
                <WrapperElement>
                    {content}
                </WrapperElement>
                {Tag !== 'figure' && CaptionElement}
            </Tag>
        </div>
    );
};
