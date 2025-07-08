
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

    return (
        <div style={wrapperStyle}>
            <Tag style={figureStyle} className={cn('group space-y-2', shadowClasses)}>
                {settings.link ? (
                    <Link href={settings.link} target={settings.linkNewTab ? '_blank' : '_self'} rel={settings.linkNofollow ? 'nofollow' : ''}>
                        {content}
                    </Link>
                ) : (
                    content
                )}
                {Tag !== 'figure' && CaptionElement}
            </Tag>
        </div>
    );
};
